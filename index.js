const express = require("express")
const connectToLnNode = require("@radar/lnrpc")
const uuid = require("uuid")

async function start() {
    const app = express()

    const lnRpc = await connectToLnNode({
        server: "localhost:10009",
        tls: "./lnd_data/tls.cert",
        macaroonPath: "./lnd_data/data/chain/bitcoin/testnet/admin.macaroon",
    })

    const hasBeenPaid = {} // Use a real DB in production

    const invoiceStream = await lnRpc.subscribeInvoices()
    invoiceStream.on("data", (invoice) => {
        if (invoice.state === 1) {
            const paymentToken = invoice.memo.split("||")[1].trim()
            hasBeenPaid[paymentToken] = true
        }
    })

    app.get("/weather", async (req, res) => {
        const paymentToken = req.header("X-Payment-Token")
        if (paymentToken) {
            if (hasBeenPaid[paymentToken]) {
                res.send("Weather report: 15 degrees Celsius, cloudy and with a chance of Lightning.")
            } else {
                res.status(400).send("Error: Invoice has not been paid")
            }
        } else {
            const paymentToken = uuid.v4()
            const invoice = await lnRpc.addInvoice({
                value: 1, // 1 satoshi == 1/100 millionth of 1 Bitcoin
                memo: `Weather report at ${new Date().toString()} || ${paymentToken}`,
            })
            res.status(402)
                .header("X-Payment-Token", paymentToken)
                .send(invoice.paymentRequest)
        }
    })

    app.listen(8000)
}

start().then(() => console.log("Listening on :8000"))