---
layout: home
---

Lightning From Scratch is the quickest guide to building an app that accepts Bitcoin Lightning payments.
  
After following this guide, you'll be able to build new kinds of apps that leverage the power of Lightning micropayments.

# What is Lightning Network?

Lightning Network (also known as "Lightning" or "LN") is a second layer on top of the Bitcoin cryptocurrency that makes payments fast, anonymous and cheap.
With it you can build apps which accept Bitcoin without sacrificing transaction speed, cost or privacy.

To do this, Lightning Network uses a construct called a payment channel: a "virtual money tube" between two peers.
A network of these payment channels enables payments to be routed between peers that don't necessarily trust each other.
 
[Read more about how Lightning Network works](https://lightning.engineering/technology.html) 

# Getting Started

In this guide we're going to build a NodeJS + ExpressJS example web app called Rain Report, which sells weather reports for Lightning micropayments.

## Run a Lightning Node

To accept Lightning payments, first we need to run a node on the Lightning Network.
For this guide we'll be using the [`lnd`](https://github.com/lightningnetwork/lnd) Lightning node implementation, written in Go.
 
To make this easy I use [Docker](https://www.docker.com/products/docker-desktop). 

1. Create a new directory `rain-report` and `cd` into it
2. Paste the underlying code into a file called `docker-compose.yml`
3. Run `docker-compose up`

```yaml
version: "3.7"

services:
  lnd:
    image: btcpayserver/lnd:v0.6-beta
    ports:
      - "9735:9735"
      - "10009:10009"
    volumes:
      - ./lnd_data:/root/.lnd
    command: >
      lnd
        --rpclisten=0.0.0.0:10009
        --bitcoin.active
        --bitcoin.testnet
        --bitcoin.node=neutrino
```

That's it! You are now running a node on the Lightning test network. 
Don't worry about losing money: the Lightning test network (testnet) doesn't use real Bitcoins. 

**For those interested: How does my Lightning node communicate with the Bitcoin network?**

Because of how Lightning Network works, a node needs to be able to read from the Bitcoin blockchain and send transactions to it.
The Lightning node you're running uses a Bitcoin backend called Neutrino to achieve this.

Neutrino is a Bitcoin "light client", meaning it doesn't download and verify the whole Bitcoin blockchain but instead only verifies transactions
relevant to its own wallet. This makes it a lot easier and cheaper to run a node, which is why I use it in this guide. 

Neutrino is still early days and potentially insecure. 
That means that once you migrate off testnet and start handling real money,
you'll need to run a "full" Bitcoin node that processes and stores every block in the blockchain 

## Build the Weather API

Now it's time to create the Weather API. Start a new NodeJS/ExpressJS project.

```bash
$ yarn init
$ yarn add express
```

Add a file `index.js` which will contain our entire web app.

```javascript
const express = require("express")

async function start() {
    const app = express()
    
    app.get("/weather", async (req, res) => {
      res.end("Uh oh! You need to pay first.")
    })
    
    app.listen(8000)
}

start().then(() => console.log("Listening on :8000"))
```

Now let's run it.

```bash
$ node index.js
Listening on :8000
```

We can see it working.

```bash
$ curl localhost:8000/weather/
Uh oh! You need to pay first.
```

Of course you can't actually pay yet. Let's fix that.

## Initialize your Lightning Wallet

Before the Weather API can get paid, you need to initialize your Lightning "wallet": the private key used to control money on your Lightning node. 

To do this we're going to run the `lncli create` command inside Docker and generate a new random private key.

Since we're running on testnet the password doesn't need to be secure.
Of course, if you run on mainnet you need a secure password or your money might get stolen. 

```bash
$ docker-compose exec lnd lncli create
Input wallet password: (satoshi7)
Confirm wallet password: (satoshi7)

Do you have an existing cipher seed mnemonic you want to use? (Enter y/n): n

Your cipher seed can optionally be encrypted.
Input your passphrase if you wish to encrypt it (or press enter to proceed without a cipher seed passphrase):

Generating fresh cipher seed...
```

You should get a printout of your "cipher seed mnemonic": 24 words that map one-to-one to your generated private key. 

Don't worry about saving this right now. But when you migrate to mainnet, you need to store the mnemonic in a secure place, like in 1Password or on a piece of paper.

Your Lightning node is now initialized and ready to go! Time to connect the Weather API to it. 

## Connect your Web App to Lightning

An app communicates with a Lightning node using an RPC protocol called [`grpc`](https://grpc.io/).   
The Node package we'll be using for this is called `@radar/lnrpc`. Let's install it.
```bash
$ yarn add @radar/lnrpc
```

In `index.js`,
```javascript
const express = require("express")
const connectToLnNode = require("@radar/lnrpc")

async function start() {
    const app = express()
    
    const lnRpc = await connectToLnNode({
        // TODO
    })
    
    // ...
}
```

The app needs three pieces of information to connect to the node:

1. Address and port, to locate the node.
2. TLS certificate, which authenticates the node.
3. Macaroon, an authentication string which enables the app to perform privileged actions like requesting money.  

The first one is easy: the node is running locally and exposes the RPC interface on port 10009.

```javascript
const lnRpc = await connectToLnNode({
    server: "localhost:10009",
    // TODO
})
```

We will use files from the `lnd_data/` directory used by `lnd` to fill the last two: TLS certificate and Macaroon.  

```javascript
const lnRpc = await connectToLnNode({
    server:         "localhost:10009",
    tls:            "./lnd_data/tls.cert",
    macaroonPath:   "./lnd_data/data/chain/bitcoin/testnet/admin.macaroon",
})
```

Test the connection by calling the [`getInfo`](https://api.lightning.community/#getinfo) Lightning RPC method.

```javascript
const lnRpc = await connectToLnNode({
    //...
})
console.log(await lnRpc.getInfo())
``` 

You should get output that looks like this.
```
{ identityPubkey:
   '020bf2ea1558744cdbf3145d7693c912fa326ecac921627491590878bb7a45d4fc',
  alias: '020bf2ea1558744cdbf3',
  ... }
```

Hooray, the app is connected to our Lightning node!

**Note: Unlocking your Wallet**

In the future, you might get an error when calling RPC methods that looks like `Error: 12 UNIMPLEMENTED: unknown service lnrpc.Lightning`.

This is because when a Lightning node starts with a wallet already initialized, it blocks calls to most RPC methods until it's unlocked with the wallet password.
There are two ways to unlock it, which one you use depends on your needs.

1. Manually execute an `lncli unlock` command after the node starts up and enter the wallet password.
Remember, in our case you would have to run `docker-compose exec lnd lncli unlock`.
2. Use the `unlockWallet` method on the `lnRpc` object in your code.
If you do this, make sure you don't hardcode the wallet password or it might get leaked when you commit it to Version Control.

## Generate a Lightning Invoice

To charge money for the `/weather` API call we need to generate a request for a Bitcoin Lightning payment. In Lightning-land this is called an "invoice".

Lightning's RPC interface exposes a method called [`addInvoice`](https://api.lightning.community/#addinvoice) that does just that.
Let's change the route handler to use it. 

```javascript
app.get("/weather", async (req, res) => {
    const invoice = await lnRpc.addInvoice({
      value: 1, // 1 satoshi == 1/100 millionth of 1 Bitcoin
      memo: "Weather report at " + new Date().toString() // User will see this as description for the payment
    })
     // Respond with HTTP 402 Payment Required
    res.status(402).send(invoice.paymentRequest)
})
```

Great! Let's test it.

```bash
$ curl localhost:8000/weather
lntb10n1pwvyxdxpp52ghumrwlvy9w2dwszw6peswy076f44juljqaje0s3dycvq6q4f0sdrc2ajkzargv4ezqun9wphhyapqv96zq4rgw5syzurjyqer2gpjxqcnjgp3xcarxve6xsezq36d2sknqdpsxqszs3tpwd6x2unwypzxz7tvd9nksapq235k6effcqzpguxmnk2rlqjw0lfq966q6szq3cy8dw2mxwjnxz6j5kfukm539s0wkvf8tmnh37njlydc6exr7yjl6j008883jxrrgkzfdv60lpjdf9vgptrxpms```
```

That long response string is the entire invoice encoded in a [special format](https://github.com/lightningnetwork/lightning-rfc/blob/master/11-payment-encoding.md), which the user enters it into their Lightning wallet to pay. 

## Paying the Invoice

TODO 

# Moving to Production

TODO