import * as core from './core';
import { Utils } from './utils';
import { Chainfeed } from './chainfeed';

interface FeedState {
    connected: boolean;
}

export class MessageFeed {
    messages: (core.Phase1Data|core.Phase2Data|core.Phase3Data|core.Phase4Data|core.Phase6Data)[];
    feedState: FeedState;
    //chainfeed: Chainfeed;

    constructor(){
        this.messages = [];
        this.feedState = { connected: false };
        //this.chainfeed = new Chainfeed();
        this.listen();
    }

    async listen(){
        Chainfeed.listen(MessageFeed.onData(this.messages), 
                            MessageFeed.onConnect(this.feedState), 
                            MessageFeed.onDisconnect(this.feedState));
    }

    async checkConnection(){
        while(!this.feedState.connected){
            console.log("[MessageFeed] Connecting...")
            await Utils.sleep(1000);
        }
        return
    }

    static onData(messages: (core.Phase1Data|core.Phase2Data|core.Phase3Data|core.Phase4Data|core.Phase6Data)[]) { 
        return function(res: any) {
            
            //console.log("New transaction found in mempool! = ", res)
            
            let txs;
            if (res.block)
                txs = res.reduce((prev: any, cur: any) => [...prev, ...cur], [])
            else
                txs = res
            
            for(let tx of txs) {

                if (!tx.data || !tx.data[0].buf || !tx.data[0].buf.data) return
                let protocol = Buffer.from(tx.data[0].buf.data).toString('hex').toLowerCase()
                if (protocol == '00424554' || protocol == '424554') {

                    //let chainbetBuf = Buffer.from(tx.data[1].buf.data);

                    var fields:(any)[] = [];
                    tx.data.forEach((item: any, index: any) => { 
                        if(index > 0)
                            fields.push(Buffer.from(item.buf.data));
                    });

                    let decodedBet = core.Core.decodePhaseData(fields);

                    decodedBet.op_return_txnId = tx.tx.hash
                    //console.log('[MessageFeed] Txn id: ' + tx.tx.hash);

                    messages.push(decodedBet);
                }
            }
        }
    }

    static onConnect(feedState: FeedState){ 
        return function(e: MessageEvent){
            feedState.connected = true;
            console.log("[MessageFeed] Connected.");
        }
    }

    static onDisconnect(feedState: FeedState){
        return function(e: MessageEvent){
            feedState.connected = false;
            console.log("[MessageFeed] Disconnected.");
        }
    }
}
