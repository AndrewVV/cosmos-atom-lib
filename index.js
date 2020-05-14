const cosmosjs = require("@cosmostation/cosmosjs");
const WeiConverter  = require('./WeiConverter');
const HttpService  = require('./HttpService');
const COSMOS_PROVIDER = "https://lcd-cosmos-free.cosmostation.io";
const COSMOS_CHAIN_ID = 'cosmoshub-3';
const COSMOS_API = 'https://api.cosmos.network/';
const API_GET_RATE_URL = 'http://51.38.158.241:8610/rate';
const TEST_ADDRESS = 'cosmos1pflcxz8x2wkcpjkqm80kkksc58784h59tc963n';

class CosmosLib {
    constructor(){
        this.mnemonic = "crouch coral refuse budget edge menu dirt flock market artist unknown dune"; // put here your mnemonic
        this.httpService = HttpService;
        this.cosmos = cosmosjs.network(COSMOS_PROVIDER, COSMOS_CHAIN_ID);

        // for test:
        // this.getBalance(false, TEST_ADDRESS).then(res => console.log(res));
        // this.getTxHistory(TEST_ADDRESS).then(res => console.log(res));
        // this.getAddressFromMnemonicATOM(this.mnemonic).then(res => console.log(res));
        // this.sendTransaction({
        //     to:'cosmos15v50ymp6n5dn73erkqtmq0u8adpl8d3ujv2e74',
        //     value: 0.1,
        //     fee: 0.0005,
        //     memo: '101885413' // typeof memo must be a string
        // }).then(res => console.log(res));
    }

    async getBalance(integer=true, address){
    	try {
            const result = await this.cosmos.getAccounts(address);
            if (result.result.value.coins.length > 0) {
                let balance = result.result.value.coins[0].amount;
                if(!integer) return balance = WeiConverter.formatToDecimals(balance, 6);
                else return balance;
            } else return 0;
    	} catch (error) {
            console.error(error)
            return 0;
	    }
    }

    async sendTransaction(data){
        try {
            let { to, value, fee, memo } = data;
            value = WeiConverter.formatFromDecimals(value, 6);
            fee = WeiConverter.formatFromDecimals(fee, 6);
            const address = await this.getAddressFromMnemonicATOM(this.mnemonic);
            const ecpairPriv = this.cosmos.getECPairPriv(this.mnemonic)
            const accountData = await this.cosmos.getAccounts(address);
            const stdSignMsg = this.cosmos.newStdMsg({
                msgs: [
                    {
                        type: "cosmos-sdk/MsgSend",
                        value: {
                            amount: [
                                {
                                    amount: String(value),
                                    denom: "uatom"
                                }
                            ],
                            from_address: address,
                            to_address: to
                        }
                    }
                ],
                chain_id: COSMOS_CHAIN_ID,
                fee: { amount: [ { amount: String(fee), denom: "uatom" } ], gas: String(200000) },
                memo,
                account_number: String(accountData.result.value.account_number),
                sequence: String(accountData.result.value.sequence)
            });
            const signedTx = this.cosmos.sign(stdSignMsg, ecpairPriv);
            const response = await this.cosmos.broadcast(signedTx);
            console.log('response', response)
            const txhash = response.txhash
            return txhash;
        } catch (error) {
           console.error(error) 
        }
    }
    // get current rate in $
    async getCurrentRate(){
        try {
            const url = `${API_GET_RATE_URL}/atom`;
            const result = await this.httpService.getRequest(url).then(response=>response.json());
            if(result.rate) return result.rate;
            else return 0;
        } catch (e) {
            console.log(e);
            return 0;
        }
    }

    async getTxHistory(address){
    	try {
            const receiveTx = await this.getReceiveTx(address);
            const sentTx = await this.getSentTx(address);
            const result = receiveTx.concat(sentTx);
            result.sort((a, b) => a.timeStamp > b.timeStamp ? -1 : 1);
			return result;
    	} catch (error) {
    	    console.error(error);
    	}
    }

    async getReceiveTx(address){
        try {
            let result = [];
            let url = `${COSMOS_API}txs?message.action=send&transfer.recipient=${address}&limit=10`
            const responce = await this.httpService.getRequest(url).then(response=>response.json());
            const totalPage = responce.page_total
            if(totalPage == '0') return result;
            url = `${COSMOS_API}txs?message.action=send&transfer.recipient=${address}&page=${totalPage}&limit=10`
            let allTx = await this.httpService.getRequest(url).then(response=>response.json());
            if(allTx) allTx = allTx.txs;
            const rate = await this.getCurrentRate();
            for(let txKey in allTx){
                let tx = allTx[txKey];
                let timeStamp = tx.timestamp;
                timeStamp = new Date(timeStamp)
                timeStamp = timeStamp.getTime()/1000; 
                const hash = tx.txhash;
                const memo = tx.tx.value.memo;
                const txFee = WeiConverter.formatToDecimals(tx.tx.value.fee.amount[0].amount, 6);
                const amount = WeiConverter.formatToDecimals(tx.tx.value.msg[0].value.amount[0].amount, 6);
                const from = tx.tx.value.msg[0].value.from_address;
                const to = tx.tx.value.msg[0].value.to_address;
                let status;
                if(tx.logs[0].success === true) status = 'CONFIRM';
                else status = FAILED;
                let action;
                if(to != from){
                    if(address == to){
                        action = 'DEPOSIT';
                    }else if(address == from){
                        action = 'SEND';
                    }
                }else{
                    action = 'SELF';
                }
                const moneyQuantity = (amount*rate).toFixed(4); 
                const id = result.length+1;
                const txData = this.formatTxData(timeStamp, id, action, status, amount, moneyQuantity, hash, from, to, txFee, memo);
                result.push(txData);
            }
            return result;
        } catch (error) {
            console.error(error)
        }
    }

    async getSentTx(address){
        try {
            let result = [];
            let url = `${COSMOS_API}txs?message.action=send&message.sender=${address}&limit=10`
            const responce = await this.httpService.getRequest(url).then(response=>response.json());
            const totalPage = responce.page_total
            if(totalPage == '0') return result;
            url = `${COSMOS_API}txs?message.action=send&message.sender=${address}&page=${totalPage}&limit=10`
            let allTx = await this.httpService.getRequest(url).then(response=>response.json());
            if(allTx) allTx = allTx.txs;
            const rate = await this.getCurrentRate();
            for(let txKey in allTx){
                let tx = allTx[txKey];
                let timeStamp = tx.timestamp;
                timeStamp = new Date(timeStamp)
                timeStamp = timeStamp.getTime()/1000; 
                const hash = tx.txhash;
                const memo = tx.tx.value.memo;
                const txFee = WeiConverter.formatToDecimals(tx.tx.value.fee.amount[0].amount, 6);
                const amount = WeiConverter.formatToDecimals(tx.tx.value.msg[0].value.amount[0].amount, 6);
                const from = tx.tx.value.msg[0].value.from_address;
                const to = tx.tx.value.msg[0].value.to_address;
                let status;
                if(tx.logs[0].success === true) status = 'CONFIRM';
                else status = FAILED;
                let action;
                if(to != from){
                    if(address == to){
                        action = 'DEPOSIT';
                    }else if(address == from){
                        action = 'SEND';
                    }
                }else{
                    action = 'SELF';
                }
                const moneyQuantity = (amount*rate).toFixed(4); 
                const id = result.length+1;
                const txData = this.formatTxData(timeStamp, id, action, status, amount, moneyQuantity, hash, from, to, txFee, memo);
                result.push(txData);
            }
            return result;
        } catch (error) {
            console.error(error)
        }
    }

    formatTxData(timeStamp, id, action, status, amount, moneyQuantity, hash, from, to, txFee, memo){
		let txData = {
            timeStamp,
            id,
            action,
            status,
            cryptoAmount: amount,
            moneyQuantity,
            copy: hash,
            explorer: `https://www.mintscan.io/txs/${hash}`,
            fromAddress: from,
            toAddress: to,
            txFee,
            memo,
		};
		return txData;
    }

    async getAddressFromMnemonicATOM(mnemonic) {
        try {
            this.cosmos.setPath("m/44'/118'/0'/0/0");
            return this.cosmos.getAddress(mnemonic);
        } catch (error) {
            console.error(error)
        }
    }

    validateAddress(address){
        if(typeof address === 'string' && address.length == 45 && address.includes("cosmos")) return true;
        return false;
    }

    getFee(){
        try {
            const result = {
                SLOW: 0.0005,
                AVARAGE: 0.00075,
                FAST: 0.001,
            }
            return result;
        } catch (error) {
            console.error(error)
        }
    }
}

let cosmosLib = new CosmosLib();