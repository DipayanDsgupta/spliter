import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // 1. Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { base64Image, settlementId } = await req.json()

        if (!base64Image || !settlementId) {
            throw new Error('Image and Settlement ID are required.')
        }

        // 2. Setup Admin Supabase client (Bypasses RLS to update the table securely)
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // 3. Verify the settlement actually exists and is pending
        const { data: settlementData, error: dbError } = await supabase
            .from('settlements_tracker')
            .select('*')
            .eq('settlement_id', settlementId)
            .single()

        if (dbError || !settlementData) {
            throw new Error(`Settlement ID ${settlementId} not found.`)
        }
        if (settlementData.status === 'completed') {
            throw new Error('Settlement already completed.')
        }
        const expectedAmount = settlementData.amount

        // 4. Send image to OCR (Using OCR.space free API as an example, since it handles Hindi/English well and is free)
        // Alternatively use Google Cloud Vision API if an API key is provided
        const formData = new FormData()
        formData.append('base64Image', `data:image/jpeg;base64,${base64Image}`)
        formData.append('language', 'eng')
        formData.append('isOverlayRequired', 'false')

        const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
            method: 'POST',
            headers: { 'apikey': 'helloworld' }, // Use a real API key or the free test key
            body: formData,
        })

        const ocrResult = await ocrResponse.json()
        if (ocrResult.IsErroredOnProcessing || !ocrResult.ParsedResults) {
            throw new Error('Failed to parse text from image.')
        }

        const extractedText = ocrResult.ParsedResults[0].ParsedText.toLowerCase()
        console.log(`Extracted Text for ${settlementId}:`, extractedText)

        // 5. Validation Logic against Extracted Text
        // Rule 1: Note must contain the settlement ID (Google Pay notes section)
        if (!extractedText.includes(settlementId.toLowerCase())) {
            throw new Error(`Invalid receipt: Settlement Reference ID (${settlementId}) not found in image.`)
        }

        // Rule 2: Payment Status must be Completed/Success
        if (!extractedText.includes('success') && !extractedText.includes('completed') && !extractedText.includes('successful')) {
            throw new Error('Invalid receipt: Payment does not appear to be successful/completed.')
        }

        // Rule 3: Amount matches (Check if the amount string exists in the text)
        // e.g., if expectedAmount is 968.75, verify "968.75" or "968" is in text
        const amountString = expectedAmount.toString()
        if (!extractedText.includes(amountString)) {
            throw new Error(`Invalid receipt: Amount ${amountString} not found in the image.`)
        }

        // Rule 4: Extract a transaction ID (very basic regex for UPI Txn ID - usually 12 digits)
        const txnMatch = extractedText.match(/\b\d{12}\b/)
        const txnId = txnMatch ? txnMatch[0] : `UNKNOWN-${Date.now()}` // Fallback if OCR missed it but Note matched

        // 6. Complete the Settlement
        const { error: updateError } = await supabase
            .from('settlements_tracker')
            .update({
                status: 'completed',
                upi_txn_id: txnId,
                verified_at: new Date().toISOString()
            })
            .eq('id', settlementData.id)

        if (updateError) {
            throw new Error('Failed to update settlement status in database.')
        }

        return new Response(JSON.stringify({
            success: true,
            message: 'Payment verified and settled successfully!',
            txnId,
            settlementId
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        console.error('OCR Verification Error:', error.message)
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
