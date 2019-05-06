const express = require("express")
const connectToLnNode = require("@radar/lnrpc")
const uuid = require("uuid")

async function start() {
    const app = express()

    const lnRpc = await connectToLnNode({
        server:         "localhost:10009", // 10009 is the GRPC port of the server LND node
        tls:            "./lnd_server/tls.cert", // Generated by LND
        macaroonPath:   "./lnd_server/data/chain/bitcoin/testnet/admin.macaroon", // Generated by LND, specific to testnet
    })
    console.log("LND info:", await lnRpc.getInfo())

    const hasBeenPaid = {}
    const invoiceStream = await lnRpc.subscribeInvoices()
    invoiceStream.on("data", (invoice) => {
        console.log("Invoice", invoice)
        if (invoice.settled) { // Settled means paid
            const purchaseId = invoice.memo.split("||")[1].trim() // Parse purchase ID out of invoice memo
            hasBeenPaid[purchaseId] = true // Mark purchase as paid
        }
    })

    app.get("/weather", async (req, res) => {
        let purchaseId = req.header("X-Purchase-Id") // Read HTTP header
        if (purchaseId) { // Client has supplied a purchase ID
            console.log("Checking purchase", purchaseId)
            if (hasBeenPaid[purchaseId]) { // Check whether purchase has been paid for
                res.send("Cloudy starting later this afternoon, with a chance of Lightning.\n")
            } else {
                res.status(400).send("Invoice not paid")
            }
        } else {
            purchaseId = uuid.v4() // Generate random new UUID
            console.log("New purchase", purchaseId)
            const invoice = await lnRpc.addInvoice({
                value: 1, // 1 "satoshi" == 1/100 millionth of 1 Bitcoin
                memo: `Weather report || ${purchaseId}` // Include purchase ID in memo so we can parse it out later
            })
            res.status(402) // HTTP 402 Payment Required
                .header("X-Purchase-Id", purchaseId) // Return purchase ID in X-Purchase-Id HTTP header
                .send(`${invoice.paymentRequest}\n`) // Send Lightning payment request in HTTP body
        }
    })

    app.listen(8000)
}

start().then(() => console.log("Listening on :8000"))
