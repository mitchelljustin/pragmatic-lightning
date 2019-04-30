"use strict"

const express = require("express")
const connectToLnNode = require("@radar/lnrpc")
const uuid = require("uuid")

async function start() {
    const app = express()

    const lnRpc = await connectToLnNode({
        server: `${process.env.LN_RPC_HOST || "localhost"}:10009`,
        tls: "./lnd_data/tls.cert",
        macaroonPath: `./lnd_data/data/chain/bitcoin/${process.env.NETWORK || "testnet"}/admin.macaroon`,
    })

    const hasBeenPaid = {} // Use a real DB in production

    const invoiceStream = await lnRpc.subscribeInvoices()
    invoiceStream.on("data", (invoice) => {
        if (invoice.state === 1) {
            const purchaseToken = invoice.memo.split("//")[1].trim()
            hasBeenPaid[purchaseToken] = true
        }
    })

    app.get("/weather", async (req, res) => {
        const purchaseToken = req.header("X-Purchase-Token")
        if (purchaseToken) {
            if (hasBeenPaid[purchaseToken]) {
                res.send("Weather report: 15 degrees Celsius, cloudy and with a chance of Lightning.")
            } else {
                res.status(400).send("Error: Invoice has not been paid")
            }
        } else {
            const purchaseToken = uuid.v4()
            const invoice = await lnRpc.addInvoice({
                value: 1, // 1 satoshi == 1/100 millionth of 1 Bitcoin
                memo: `Weather report at ${new Date().toString()} // ${purchaseToken}`,
            })
            res.status(402)
                .header("X-Purchase-Token", purchaseToken)
                .send(invoice.paymentRequest)
        }
    })

    app.listen(8000)
}

start().then(() => console.log("Listening on :8000"))