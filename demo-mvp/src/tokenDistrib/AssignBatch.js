// Setup variables such as the ethereumNodeURL and the batch file
let batchFilePath = process.argv[2]
let tokenSaleAddress = process.argv[3]
let local = process.argv[4]
let ethereumNodeURL = process.argv[5]

const usage = "node AssignBatch.js [path-to-batch-file] [BTUTokenSale-eth-address] ?[true/any]:local"
if (ethereumNodeURL == undefined) {
    ethereumNodeURL = 'http://localhost:9545'
}

if (tokenSaleAddress == undefined) {
    console.log('This script needs the BTUTokenSale contract address !')
    console.log(usage)
    process.exit(1)
}

if (batchFilePath == undefined) {
    console.log('This script needs a batch file to assign token to addresses !')
    console.log(usage)
    process.exit(2)
}

const fs = require('fs')
const path = require('path')

let batchFileData = []

try {
    const BATCH_FILE_PATH = path.resolve(batchFilePath)
    batchFileData = fs.readFileSync(BATCH_FILE_PATH).toString().split('\n').filter(x => x)
    console.log("Num accounts = " + batchFileData.length)
} catch (error) {
    console.error("Could not open file at " + batchFilePath + " [" + error + "]")
    process.exit(3)
}

const BTUTokenSale = require('../src/BTU/BTUTokenSale')
const BTU = require('../src/BTU/BTU')

// Relying on third argument, define the web3 provider
var HDWalletProvider = require("truffle-hdwallet-provider")
var mnemonic = "impact stay fish oil hover solar excess monster output fence razor celery"
var provider = (local !== 'undefined' && local == 'true') ?
    new Web3.providers.HttpProvider('http://localhost:9545') :
    new HDWalletProvider(mnemonic, "https://ropsten.infura.io/DYBja4A1RKCdnSP4DMYt")
web3.setProvider(provider)

web3.eth.net.isListening().then(function (res) {
    console.log("IsConnected = " + res)
})

let btuTokenSale = new web3.eth.Contract(BTUTokenSale.abi, tokenSaleAddress)
console.log("BTUTokenSale address = " + BTUTokenSale.address)

console.log("Accounts: \n" + batchFileData.join('\n'))
let addresses = []
let amounts = []
batchFileData.forEach(function (account) {
    let values = account.split(',').filter(x => x)
    if (values.length == 2) {
        addresses.push(values[0])
        amounts.push(5 * Math.pow(10, 18))
    } else {
        console.log("Error parsing batch file !")
        process.exit(4)
    }
});

//web3.eth.defaultAccount = web3.eth.accounts[0];

function getBTUToken() {
    return new Promise(function (resolve, reject) {
        btuTokenSale.methods.btuToken().call(function (err, res) {
            if (err) return reject(err)
            resolve(res)
        });
    });
}

function assignBatch(account, addrs, amnts) {
    return new Promise(function (resolve, reject) {

        btuTokenSale.methods.assignTokens(addrs, amnts).estimateGas({
            from: account
        }).then(function (estimatedGas) {
            console.log("Estimated gas = " + estimatedGas)
            // Add 10% to the gas limit
            let gasLimit = estimatedGas + Math.ceil(10 * estimatedGas / 100)
            console.log("GasLimit = " + gasLimit)
            btuTokenSale.methods.assignTokens(addrs, amnts).send({
                from: account,
                gas: gasLimit
            }, function (err, res) {
                if (err) {
                    console.log("Error assigning tokens: " + err)
                    return reject(err)
                }
                resolve(res)
            })
        })
    })
}

async function assignTokens(account, addrs, amnts) {
    for (let i = 0; i < addresses.length; ++i) {
        await assignBatch(account, addrs.splice(0, 5), amnts.splice(0, 5))
    }
}

web3.eth.getAccounts(function (error, accounts) {
    console.log("Using account: " + accounts[0])
    let totalAllowance = amounts.reduce((a, b) => a + b, 0)

    getBTUToken().then(function (btuToken) {
        console.log("BTUToken address = " + btuToken)
        let btu = new web3.eth.Contract(BTU.abi, btuToken)
        btu.methods.balanceOf(tokenSaleAddress).call(function (error, result) {
            console.log("TokenSaleAddress Balance = " + result)
        });

        assignTokens(accounts[0], addresses, amounts)

    }, function (err) {
        console.log(err)
    });
});
