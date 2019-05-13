---
title: Pragmatic Lightning | Build a Bitcoin Lightning app in under 1 hour.
---

# Introduction

{{site.title}} is a guide for building an app that accepts Bitcoin micropayments using [Lightning Network](http://lightning.network/).

Unlike other guides, {{site.title}} focuses on building a fully functional app running on Lightning testnet with the lowest amount of time and effort.

You can get up and running in 10 minutes, and finish the full guide in less than 1 hour.

**Things you can build include..**
- [A VPN that charges by the hour](https://metervpn.com?utm_source=pragmatic-lightning&utm_medium=blog)
- [A Bitcoin tipping bot for Twitter](https://tippin.me/)
- [A cloud service provider that doesn't require identification](https://sporestack.com/)  
- A service that sells AI training data by the Megabyte
- An adult content website with builtin micropayments

**This guide is for anyone who..**

- Wants to build a Bitcoin app but hesitates because transactions are slow, expensive and/or not private.
- Has an idea for a micropayment app but hasn't found a way to build it. 
- Has heard of Lightning Network and wants to learn by building on it.
- Has tried to follow other guides but gave up because they were too difficult.

**This guide will help you..**

- Build an app that accepts real Bitcoin payments on Lightning Network.
- Understand roughly what Lightning Network is, how it works and how to build on it.
- Become more familiar with Lightning wallet and node software.

**This guide assumes familiarity with..**

- Web development
- NodeJS and ExpressJS
- Bitcoin

# Background

## Why Bitcoin?

While there are other cryptocurrencies you could build on, the author of this guide believes Bitcoin is currently the best option.
It has a proven 10+ year track record of not getting hacked or politically subverted.
As a result it has the most liquid market, the most stable price and the best brand recognition.

So far, Bitcoin is shaping up to be a true native currency for the Internet. 

From a developer standpoint, the biggest downside of Bitcoin is that transactions are slow and expensive. 
The Lightning Network fixes this flaw by adding a new layer on top of Bitcoin.

## What is Lightning Network?

Lightning Network (also known as "Lightning" or "LN") is a second layer network on Bitcoin.
Unlike traditional Bitcoin payments, payments on Lightning Network are extremely fast, cheap and anonymous.

It uses a construct called a payment channel: a "virtual money tube" between two peers.
A network of these channels plus special Bitcoin scripts called [HTLCs (Hashed Time Locked Contracts)](https://en.bitcoin.it/wiki/Hash_Time_Locked_Contracts) 
enables payments to be routed through peers that don't have to trust each other. [Read more about the underlying technology](https://lightning.engineering/technology.html).

**Note**: Lightning Network is still at an early stage. 
There aren't yet set standards on how to interact with it from an app's perspective.
This guide follows the best currently known practices, but these are subject to change in the future.   

---


# Build a Lightning App

In this guide we're going to build a NodeJS + ExpressJS web API which sells weather reports for Lightning micropayments,
 called Rain Report.
 
**Note**: Returning real weather reports is out of scope for this guide. This app will return hardcoded reports.

**Prerequisites**:
- Unix-based OS (Mac OSX, Linux, FreeBSD etc). If you're a Windows user, you'll need to [run in a Linux VM](https://itsfoss.com/install-linux-in-virtualbox/).
- Node v8.0.0+

## Create web app

Start by creating a vanilla NodeJS/ExpressJS project.

```sh
mkdir rain-report
cd rain-report
yarn init
yarn add express
```

**Note**: *You may substitute `npm` for `yarn` wherever it's used in this guide.
Just make sure instead of `yarn add` you run `npm install --save`.*

Add a file "index.js" which will contain our entire web app.

```javascript
const express = require("express")

async function start() {
    const app = express()
    
    app.get("/weather", async (req, res) => {
      res.send("Uh oh! You need to pay first.")
    })
    
    app.listen(8000)
}

start().then(() => console.log("Listening on :8000"))
```

Now let's run it.

```sh
$ node index.js
Listening on :8000
```

We can see it working.

```sh
$ curl localhost:8000/weather/
Uh oh! You need to pay first.
```

Of course you can't actually pay yet. Let's fix that.

## Start Lightning node

To accept Lightning payments, you need to run a node on the Lightning Network.
For this guide we'll be using the [LND (Lightning Network Daemon)](https://github.com/lightningnetwork/lnd) implementation, written in Go.

**Note: Don't worry about losing money, this Lightning node will run on the test network (testnet) which doesn't use real Bitcoins.
To accept real Bitcoins, the Lightning node has to run on the main network (mainnet).**

This guide provides a care package to install LND and a set of convenience scripts. Run 
```sh
curl https://raw.githubusercontent.com/mvanderh/pragmatic-lightning/master/install.sh | bash
```

This downloads the LND binaries into a local folder, and preloads testnet blockchain data so that
 you don't have to wait 15 minutes for LND to download and verify it.
 
It also creates 2 distinct LND "environments", client and server, so that we can easily simulate payments
between the user and your web app. Each environment has 2 convenience scripts: 
LND (node daemon) and LNCLI (CLI to control the node daemon). 

Start the server LND instance by running

```bash
./server-lnd.sh
```

That's it! We're now running a node on the (testnet) Lightning Network that our web app will connect with to accept Bitcoin payments.

**Sidenote: The Big Blockchain**

*Because of how Lightning Network works, a node needs to be able to read from the Bitcoin blockchain and send transactions to it.
To achieve this, the Lightning node you're running uses a Bitcoin node implementation called [Neutrino](https://github.com/lightninglabs/neutrino).*

*Neutrino is a Bitcoin "light client", meaning it doesn't download and verify all 200GB+ of the Bitcoin blockchain but instead only verifies transactions
relevant to its own wallet. This makes it a lot easier and cheaper to run a node, which is why this guide uses it.*

*Neutrino is still early days and potentially insecure.
Therefore, the creators of LND have restricted its use to testnet only.*
 
*Once you migrate off testnet and start handling real money,
you'll need to run a ["full" Bitcoin node](https://bitcoin.org/en/full-node) that processes and stores every block in the blockchain.
This will hopefully change in the near future.*

**Next step: Initializing the Lightning node's wallet**

Before your web app can connect to the server LND, you need to initialize the Lightning "wallet": 
the [private key](https://en.bitcoin.it/wiki/Private_key) used to control the money on an LND node.

To do this, we'll run a "create" command with the server LNCLI and generate a new random private key.

Since the node is on testnet, security isn't that important: you can pick a simple 8-character wallet password like "satoshi7".

In a new terminal,
```sh
$ ./server-lncli.sh create
Input wallet password: satoshi7
Confirm wallet password: satoshi7

Do you have an existing cipher seed mnemonic you want to use? (Enter y/n): n

Your cipher seed can optionally be encrypted.
Input your passphrase if you wish to encrypt it (or press enter to proceed without a cipher seed passphrase):

Generating fresh cipher seed...
```

The command will print out your "cipher seed mnemonic": 24 English words that map one-to-one to your generated private key.
You can ignore this for now and move on to the next section.

**Note**: You can now find out whether LND is done syncing by running `./server-lncli.sh getinfo` 
and checking whether "synced_to_chain" is set to true in the output.

**Sidenote: Production Security**

*When the app is migrated to mainnet, you'll need to generate a new mnemonic and store it in a secure place, like in 1Password or on a piece of paper.
You should also use a different, secure wallet password or your money might get stolen.*

*Please make sure you don't lose either your password or your mnemonic. 
Unlike traditional payment methods such as Stripe or Paypal, with Bitcoin+Lightning there's no one to bail you out if you lose them.*

## Connect web app to Lightning

An app communicates with a Lightning node using an [RPC (Remote Procedure Call)](https://en.wikipedia.org/wiki/Remote_procedure_call)
 protocol called [GRPC](https://grpc.io/). 
The app will be using a Node package called ["@radar/lnrpc"](https://www.npmjs.com/package/@radar/lnrpc).

--- DRAW PARALLEL BETWEEN RPC METHODS AND LNCLI COMMANDS --- 

```sh
yarn add @radar/lnrpc
```

This package mirrors the [LND gRPC methods](https://api.lightning.community/) in NodeJS,
which keeps things nice and clean.

Require it at the top of "index.js",
```javascript
const express = require("express")
const connectToLnNode = require("@radar/lnrpc") 
```

LNRPC needs three pieces of information to connect to the node:

1. Address and port, to locate the node.
2. TLS certificate, to authenticate the node.
3. Macaroon, an authentication string which enables the app to perform privileged actions like requesting money.  

The address and port are easy: the node is running on localhost and exposes the RPC interface on port 10009.

LND generates the last two pieces as files: "tls.cert" and "admin.macaroon". They're in the "lnd_server/" directory

Altogether we write:  

```javascript
async function start() {
    const app = express()
    
    const lnRpc = await connectToLnNode({ 
        server:         "localhost:10009", // 10009 is the GRPC port 
        tls:            "./lnd_server/tls.cert", // Generated by LND
        macaroonPath:   "./lnd_server/data/chain/bitcoin/testnet/admin.macaroon", // Generated by LND, specific to testnet
    })
    
    //...
} 
```

Test the connection by calling the [`getInfo`](https://api.lightning.community/#getinfo) Lightning RPC method.

```javascript
const lnRpc = await connectToLnNode({
    //...
})
console.log("LND info:", await lnRpc.getInfo()) 
``` 

You should get output that looks like this.
```
LND Info: { identityPubkey:
   '020bf2ea1558744cdbf3145d7693c912fa326ecac921627491590878bb7a45d4fc',
  alias: '020bf2ea1558744cdbf3',
  ... }
```

**Sidenote: Unlocking your Wallet**

*In the future, you might get an error when calling LN RPC methods that looks like `Error: 12 UNIMPLEMENTED: unknown service lnrpc.Lightning`.*

*This is because when a Lightning node restarts with a wallet already initialized, it blocks calls to most RPC methods until it's unlocked with the wallet password.
There are two ways to unlock it, which one you should use depends on your needs.*

*1. Manually execute an LNCLI "unlock" command after the node starts up and enter the wallet password.*

*2. Use the [`unlockWallet`](https://api.lightning.community/#unlockwallet) RPC method in your code.
If you do this, make sure you don't hardcode the wallet password or it might get leaked when you commit it to Version Control.*

## Generate payment request

To charge money for the `/weather` API call we need to generate a request for a Lightning payment. In Lightning-land this is called an *invoice*.

LND's RPC interface exposes a method called [`addInvoice`](https://api.lightning.community/#addinvoice) that does just that.
Let's change the route handler to use it. 

```javascript
app.get("/weather", async (req, res) => {
    const invoice = await lnRpc.addInvoice({
      value: 1, // 1 satoshi == 1/100 millionth of 1 Bitcoin
      memo: `Weather report` // User will see this as description for the payment
    })
     // Respond with HTTP 402 Payment Required
    res.status(402).send(`${invoice.paymentRequest}\n`)
})
```

Restart the server and test it.

```sh
$ curl localhost:8000/weather
lntb10n1pwvyxdxpp52ghumrwlvy9w2dwszw6peswy076f44juljqaje0s3dycvq6q4f0sdrc2ajkzargv4ezqun9wphhyapqv96zq4rgw5syzurjyqer2gpjxqcnjgp3xcarxve6xsezq36d2sknqdpsxqszs3tpwd6x2unwypzxz7tvd9nksapq235k6effcqzpguxmnk2rlqjw0lfq966q6szq3cy8dw2mxwjnxz6j5kfukm539s0wkvf8tmnh37njlydc6exr7yjl6j008883jxrrgkzfdv60lpjdf9vgptrxpms
```

Great! 

That long response string is the entire Lightning invoice 
encoded in a [special format](https://github.com/lightningnetwork/lightning-rfc/blob/master/11-payment-encoding.md), 
which the user enters it into their Lightning wallet to pay.

To pay it we need to set up a client wallet and open a channel with the server. 

## Set up client wallet

Setting up the client wallet is very similar to the server. Let's first start the client LND.

```bash
./client-lnd.sh
```

To initialize the client wallet,
```sh
$ ./client-lncli.sh create
Input wallet password: satoshi7
Confirm wallet password: satoshi7

Do you have an existing cipher seed mnemonic you want to use? (Enter y/n): n

Your cipher seed can optionally be encrypted.
Input your passphrase if you wish to encrypt it (or press enter to proceed without a cipher seed passphrase):

Generating fresh cipher seed...
```

Same as the server wallet, the command will print out a 24-word mnemonic for the client wallet. Once again, ignore this. 

**Get testnet Bitcoins**

--- MAKE OBVIOUS THAT FAUCET IS AN OUTSIDE SERVICE ---

To open a channel and pay the server, the client first needs to have testnet Bitcoins.

We're going to get testnet coins by using a "faucet": a service that gives out coins for free. 
[Yet Another Bitcoin Testnet Faucet](https://testnet-faucet.mempool.co/) is the easiest to use, but feel free to use another if you want.

The faucet will ask for a (Bitcoin) address to send coins to. To generate a Bitcoin address on the client, run
```sh
./client-lncli.sh newaddress p2wkh
```
*(["p2wkh"](https://bitcoin.stackexchange.com/questions/64733/what-is-p2pk-p2pkh-p2sh-p2wpkh-eli5)
 is the type of address you're generating; don't worry about the details for now.)*

If you're using Yet Another Bitcoin Testnet Faucet, enter 0.01 for the amount and hit Send.

It'll take a while (5-10 mins) for the coins to be confirmed. Feel free to grab a coffee or a snack.

To check whether the transaction is confirmed yet, run
```sh
./client-lncli.sh walletbalance
```

If the "confirmed_balance" amount is greater than zero, that means you have received the coins and can move on to the next section. 

**Open channel with server**

Now's the exciting part: we're going to open a Lightning payment channel from the client to the server. 

We need to know the server node's public key. Run
```sh
$ ./server-lncli.sh getinfo
{
	"version": "0.6.0-beta commit=v0.6-beta",
	"identity_pubkey": "0320d15fa61ec53ce40fb8adaa6a6d1c7b9aa8b18e6b2c4249217177441f522353"
	...,
}
```
The string in "identity_pubkey" is the server node's public key.

First connect the client node to the server node
```sh
$ ./client-lncli.sh connect <server_pubkey>@localhost:9735
{

}
```

Then, open a channel with 100,000 satoshis in it.
```sh
./client-lncli.sh openchannel <server_pubkey> 100000
```

Like the faucet transaction, the channel transaction will take a while (5-10 mins).

See the pending channel by running
```sh
./client-lncli.sh pendingchannels
```

Check whether the channel transaction is confirmed by running
```sh
./client-lncli.sh listchannels
```
If you see an item in the "channels" array which has "active" set to true, then your channel is open and ready to go.

**Note**: If your channel keeps showing "active": false, try restarting 
both server and client LNDs and wait a while for them to re-discover each other. 
You might have to [forcefully kill](https://stackoverflow.com/questions/3510673/find-and-kill-a-process-in-one-line-using-bash-and-regex) the LND process if it doesn't quit with Ctrl+C.

**Sidenote: Inbound Liquidity**

*In Lightning nomenclature, the amount of Bitcoin on the other side of your channels is called "inbound liquidity".
When a Lightning node lacks inbound liquidity, payments sent to it frequently can't find an adequate payment route through the network and fail.*

*Unfortunately it's still difficult to get decent inbound liquidity for your node. This greatly hampers widespread adoption of Lightning
as a payment infrastructure.*

*Luckily, researchers and developers in the Lightning ecosystem
are constantly iterating on solutions to this problem, among them 
[Lightning Loop](https://blog.lightning.engineering/posts/2019/03/20/loop.html),
[Inbound Capacity Providers](https://medium.com/lightningto-me/practical-solutions-to-inbound-capacity-problem-in-lightning-network-60224aa13393) and
[Atomic Multipath Payments](https://bitcoinist.com/atomic-multi-path-help-bitcoin-become-formidable-payment-instrument/).*

*Another note of interest: contrary to what we're doing in this guide, 
on mainnet both you and a user would open channels with a well-connected hub instead of a direct channel.
That way you can send and receive payments from and to many different nodes.*

## Pay the invoice

Once your channel is open, you can pay an invoice from your API.

First fire off a request for a weather report. 

```sh
$ curl localhost:8000/weather
lntb10n1pwvyxdxpp52ghumrwlvy9w2dwszw6peswy076f44juljqaje0s3dycvq6q4f0sdrc2ajkzargv4ezqun9wphhyapqv96zq4rgw5syzurjyqer2gpjxqcnjgp3xcarxve6xsezq36d2sknqdpsxqszs3tpwd6x2unwypzxz7tvd9nksapq235k6effcqzpguxmnk2rlqjw0lfq966q6szq3cy8dw2mxwjnxz6j5kfukm539s0wkvf8tmnh37njlydc6exr7yjl6j008883jxrrgkzfdv60lpjdf9vgptrxpms
```
    
--- TODO: MIGHT HAVE TO WAIT A WHILE OR PAYMENT ROUTE WONT BE FOUND ---

Pay the invoice from the client
```sh
$ ./client-lncli.sh payinvoice <your_invoice_string>
Description: Weather report || 88700285-4a4e-4c51-b0e6-7ac4709f5aba
Amount (in satoshis): 1
Destination: 0320d15fa61ec53ce40fb8adaa6a6d1c7b9aa8b18e6b2c4249217177441f522353
Confirm payment (yes/no): yes
{
    "payment_error": "",
    "payment_preimage": "d596bf7a40eb4707e186ad5f4b6eb95a657b0d3b9495c4728bab303a236f9661",
    ...
}
```

Voilá! Your first weather report has been bought and paid for. 

Actually, you might notice you didn't get a report back from the API call.
That's because you haven't written code to verify that a report was paid for, and if so to send it to the user. 

## Verify purchases on server

Final step! This is the "meat" of the guide so to speak.

To verify the purchase of a report we need to do three things:

1. Generate a unique ID for each new purchase along with the invoice.
2. Read settled invoices as they come in and mark their corresponding purchase IDs as completed.
3. Send report to users who have paid only by checking the purchase ID.

We're going to send the purchase ID as an HTTP header called `X-Purchase-Id`. Once again,
there are no set standards yet so we make up our own. 

To keep it simple we're using [UUIDs](https://en.wikipedia.org/wiki/Universally_unique_identifier) for purchase IDs.
Add the ["uuid"](https://www.npmjs.com/package/uuid) package to your project. 
```sh
yarn add uuid
```

Require it at the top of "index.js"
```javascript
const uuid = require("uuid")
```

On a `/weather` API call, generate a new purchase ID. Include it in the invoice memo so we can
mark it as paid when we're reading invoices later.

```javascript
app.get("/weather", async (req, res) => {
    const purchaseId = uuid.v4() // Generate random new UUID
    const invoice = await lnRpc.addInvoice({
        value: 1, // 1 satoshi == 1/100 millionth of 1 Bitcoin
        memo: `Weather report || ${purchaseId}`,
    })
    res.status(402) // HTTP 402 Payment Required
        .header("X-Purchase-Id", purchaseId) // Return purchase ID in X-Purchase-Id HTTP header
        .send(`${invoice.paymentRequest}\n`) // Send Lightning payment request in HTTP body
})
```

We need to mark purchase IDs as completed by reading invoices on the fly.
The RPC method for this is [`subscribeInvoices`](https://api.lightning.community/#subscribeinvoices).

```javascript
const purchaseCompleted = {} // Use a real DB in production
const invoiceStream = await lnRpc.subscribeInvoices()
invoiceStream.on("data", invoice => {
    console.log("Invoice:", invoice)
    if (invoice.settled) { // "Settled" means paid
        const purchaseId = invoice.memo.split("||")[1].trim() // Parse purchase ID out of invoice memo
        purchaseCompleted[purchaseId] = true // Mark purchase as paid 
    }
})

app.get("/weather", async (req, res) => { //...
```

Finally, tie it all together by checking for a `X-Purchase-Id` request header and returning the report if the header is a valid, paid purchase ID.

```javascript
app.get("/weather", async (req, res) => {
    const purchaseId = req.header("X-Purchase-Id") // Read HTTP header
    if (purchaseId) { // Client has supplied a purchase ID
        console.log("Checking purchase", purchaseId)
        if (purchaseCompleted[purchaseId]) { // Check whether purchase has been paid for
            res.send("15 degrees Celsius, cloudy and with a chance of lightning.")
        } else {
            res.status(400).send("Error: Invoice has not been paid")
        }
    } else {
        const purchaseId = uuid.v4() // Generate random new UUID
        console.log("New purchase", purchaseId)
        const invoice = await lnRpc.addInvoice({
            value: 1, // 1 satoshi == 1/100 millionth of 1 Bitcoin
            memo: `Weather report || ${purchaseId}`, // Include purchase ID in memo so we can parse it out later
        })
        res.status(402) // HTTP 402 Payment Required
            .header("X-Purchase-Id", purchaseId) // Return purchase ID in X-Purchase-Id HTTP header
            .send(`${invoice.paymentRequest}\n`) // Send Lightning payment request in HTTP body
    }
})
```

Let's test it. Note we use the `curl -v` option to obtain the "X-Purchase-Id" header.
```sh
$ curl -v localhost:8000/weather
...

< HTTP/1.1 402 Payment Required
< X-Powered-By: Express
< X-Purchase-Id: d439499f-237b-4e28-9fc3-d1854144ced4
< Content-Type: text/html; charset=utf-8
< Content-Length: 372
< ETag: W/"174-+SX9JPCZpKw9P96pvXIXPsOn5Pc"
< Date: Mon, 29 Apr 2019 19:02:42 GMT
< Connection: keep-alive
<
* Connection #0 to host localhost left intact
lntb10n1pwvwjjjpp5fnrkz0sa830s8lqza8tdflwqr8s6cegvqkmy60a44qfc79t5fh4qd9c2ajkzargv4ezqun9wphhyapqv96zqnt0dcsyzurjyqerjgpjxqcnjgp3x5arqv36xsezq36d2sknqdpsxqszs3tpwd6x2unwypzxz7tvd9nksapq235k6effyqhj7gryxsenjdpe89nz6v3nxa3z6dr9xguz6wtxvvej6ep38q6ngvf5x33k2ep5cqzpg6rk3card20ca5j3p0x70waz3xa6y4zjjp8e9m0wd8356850hkcuklmpfvmkluz8y0l2yer74j5ja3ar5grej6mjk6d262etwpv3mcxcppxkr6d
```

Pay the invoice on the client

```sh
$ ./client-lncli.sh payinvoice lntb10n1pwvyxdxpp52ghumrwlvy9w2dwszw6peswy076f44juljqaje0s3dycvq6q4f0sdrc2ajkzargv4ezqun9wphhyapqv96zq4rgw5syzurjyqer2gpjxqcnjgp3xcarxve6xsezq36d2sknqdpsxqszs3tpwd6x2unwypzxz7tvd9nksapq235k6effcqzpguxmnk2rlqjw0lfq966q6szq3cy8dw2mxwjnxz6j5kfukm539s0wkvf8tmnh37njlydc6exr7yjl6j008883jxrrgkzfdv60lpjdf9vgptrxpms
Description: Weather report || 88700285-4a4e-4c51-b0e6-7ac4709f5aba
Amount (in satoshis): 1
Destination: 0320d15fa61ec53ce40fb8adaa6a6d1c7b9aa8b18e6b2c4249217177441f522353
Confirm payment (yes/no): yes
{
    "payment_error": "",
    "payment_preimage": "d596bf7a40eb4707e186ad5f4b6eb95a657b0d3b9495c4728bab303a236f9661",
    ...
}
```

Then call the API again with the same purchase ID.
 
```sh
$ curl localhost:8000/weather -H X-Purchase-Id:d439499f-237b-4e28-9fc3-d1854144ced4
15 degrees Celsius, cloudy and with a chance of Lightning.
```

Boom! We've successfully purchased a weather report with Lightning micropayments.

**Done!**

You've built a functional Lightning app from scratch. Nice!

[For reference, here's the entire completed project.](https://github.com/mvanderh/pragmatic-lightning/blob/master/rain-report)

The next step is to move your app off of Lightning testnet and onto mainnet, where you can get paid with real money.

**Sidenote: User Experience**

*Obviously, this is not how you'd want a user to interact with your app. `curl`ing a URL, 
pasting the invoice into an app, clicking pay and then `curl`ing again to get the report is a pretty terrible user experience.*

*To make your app more user-friendly, either add a Web client to your app and use 
[Lightning Payment URIs](https://github.com/lightningnetwork/lightning-rfc/blob/master/11-payment-encoding.md#encoding-overview) or 
[WebLN](https://github.com/joule-labs/webln) to show invoices to the user,
 or write a client-side app with a builtin Lightning node that handles payments for the user automatically.* 

# Migrate to Mainnet

This whole endeavour becomes much more interesting if the app can get paid with real-world money instead of test coins.
In the current state of Lightning and Bitcoin development, it still takes a decent amount of effort to get there. 

The next section breaks it down for you and makes it as easy as possible.  

**Run web app in production**

As with any web application you need to find a server machine to run it on. 

Nowadays most web apps run on cloud providers like Digital Ocean or AWS, which also works
for Lightning apps. 

Since you're dealing with real money, take extra care in securing access to the server.

**Switch to mainnet**

Next, for an app to accept real Bitcoins its Lightning node needs to run on mainnet. 

In the future this will be as easy as adding a `--bitcoin.mainnet` config flag to LND and continuing to use Neutrino.

Unfortunately as of now (May 2, 2019) the Neutrino Bitcoin node used in this guide is still experimental, 
and LND won't allow you to use it on mainnet where money could be lost.

**Full Bitcoin node** 

You need to run a full Bitcoin node which downloads and verifies the whole 200GB+ blockchain.
There are two ways to do this:
 
1. Write a "docker-compose.yml" for production, which includes a container with a full Bitcoin node.
1. Install and run the Lightning and Bitcoin nodes on your local machine (not with Docker).

For either option you need at least 500GB of disk space, to store the full Bitcoin blockchain now and well into the future.
Make sure of this when you set up your app on a cloud provider or elsewhere. 

**Docker-compose.yml for production**

I've written a ["production" docker-compose.yml file](prod/docker-compose.yml) 
that has containers for a mainnet Bitcoin node and a mainnet LND node, and connects them. 

I also included an "app" container and Dockerfile that sets convenient environment variables for the app to connect to LND.
You can find all this code in [the Rain Report project folder](https://github.com/mvanderh/pragmatic-lightning/blob/master/rain-report).

To use the production docker-compose.yml, run
 
```sh
$ curl -O https://mvanderh.github.io/pragmatic-lightning/rain-report/docker-compose.production.yml -O https://mvanderh.github.io/pragmatic-lightning/rain-report/Dockerfile
$ docker-compose -f docker-compose.production.yml up
```

**Run without Docker**

Alternatively, you can choose to install and run the Bitcoin and Lightning nodes directly on the machine. 
There are many guides that will help you do this. 
The best and most up to date is probably the [LND installation guide by Lightning Labs](https://github.com/lightningnetwork/lnd/blob/master/docs/INSTALL.md).

**Initialize mainnet wallet**

Once you've switched to mainnet, you need to initialize your Lightning wallet. 
Follow the same procedure from the [Start Lightning node](#start-lightning-node) section but use a secure wallet password, and
save the 24-word mnemonic in a safe place. 

**Migrate app to production**

From the app's perspective, only one thing has to change for it to work on mainnet: the path to the Macaroon that it uses
for RPC calls.
 
However, there are additional changes you need to make if you run the app in a Docker container: 

1. Point the app at the Lightning node running in another container
2. Link the Lightning node's volume in the app container so it can read the TLS certificate and Macaroon

I've included all of these changes plus convenient environment
variables in the [completed version of the Rain Report app](https://github.com/mvanderh/pragmatic-lightning/blob/master/rain-report).
 
**Get inbound liquidity**

Lastly, you need to have other Lightning nodes open channels with you so that you can get paid by users. 
Like mentioned in a sidenote earlier, this is still pretty difficult.

There are free services that will open a channel with you, such as 
[LNBig](https://lnbig.com) or [LightningTo.me](https://lightningto.me/).

There are also services which require a fee, for instance [Thor](https://www.bitrefill.com/thor-lightning-network-channels/?hl=en).
Presumably these paid hubs are better connected or ask lower routing fees.

In the future, liquidity techologies like 
[Lightning Loop](https://blog.lightning.engineering/posts/2019/03/20/loop.html) and
[Atomic Multipath Payments](https://bitcoinist.com/atomic-multi-path-help-bitcoin-become-formidable-payment-instrument/)
will be helpful in routing payments to your node. 

This problem is sure to become easier over time as more people join the Network and more hubs spring into existence.

**Best practices**

A few best practices to minimize the risk of your money getting stolen or lost:

- Update LND when a new version comes out to fix security bugs (and to get cool new features). 
- Don't put more than $50 USD on Lightning node wallet, until Lightning Network becomes more mature.
- Run the web app under a separate Unix user from the Lightning and Bitcoin nodes.

# Epilogue

Pragmatic Lightning was borne out of frustration in setting up Lightning payments for my own app, [MeterVPN](https://metervpn.com?utm_source=pragmatic-lightning&utm_medium=blog).
In the process, I read through many guides and made numerous mistakes.

Hopefully it prevents others from dealing with the same problems and frustrations
in setting up Lightning, and instead to get them straight to building Lapps.

Thanks for reading! If you have any comments or criticism, please let me know at --- INSERT CONTACT INFO --- 

**Sources**

- [LND installation guide on Github](https://github.com/lightningnetwork/lnd/blob/master/docs/INSTALL.md)
- [Lightning.community tutorials](https://dev.lightning.community/tutorial/index.html)
- [Zap iOS node remote setup guide](https://ln-zap.github.io/zap-tutorials/iOS-remote-node-setup.html)
- [The LND Github Issues page](https://github.com/lightningnetwork/lnd/issues)

**Social Links**

<a href="https://twitter.com/scalefree_?ref_src=twsrc%5Etfw" class="twitter-follow-button" data-size="large" data-show-screen-name="false" data-show-count="false">Follow @scalefree_</a><script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>