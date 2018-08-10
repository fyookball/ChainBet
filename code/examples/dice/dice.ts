import * as chainbet from 'chainbet';

import BITBOXCli from 'bitbox-cli/lib/bitbox-cli';
let BITBOX = new BITBOXCli();

import * as fs from 'fs';
let context = require('commander');
import * as inquirer from 'inquirer';
import * as jsonfile from 'jsonfile';

context.version('0.0.13')
        .option('-m, --mode [mode]', 'set program mode to bypass initial prompt')
        .option('-d, --debug [debug]', 'set debugger support (skips user prompts with default values)')
        .parse(process.argv);
    
context.debug = (context.debug == "1" ? true : false);

async function main() {
    while(true){
        var wallet;

        // present main menu to user
        let selection: any = await promptMainMenu();

        // check if wallet.json file exists
        if(fs.existsSync('./wallet.json')) {
            if (selection.mode == 'generate') {
                console.log("\nGenerating a new bitcoin address...\n");
                var wif = chainbet.Utils.getNewPrivKeyWIF();
                wallet = jsonfile.readFileSync('./wallet.json');
                wallet.push({ 'wif' : wif });
                jsonfile.writeFileSync("./wallet.json", wallet, 'utf8');
            }
        }

        wallet = jsonfile.readFileSync('./wallet.json');
        // context.wif = wallet[wallet.length - 1].wif;
        // let ecpair = BITBOX.ECPair.fromWIF(context.wif);
        // context.pubkey = BITBOX.ECPair.toPublicKey(ecpair);
        // context.address = BITBOX.ECPair.toCashAddress(ecpair);
        // console.log("\nYour address is: " + context.address);

        // Use chainfeed.org for OP_RETURN messages
        let chainfeed = new chainbet.MessageFeed();
        await chainfeed.checkConnection();

        var wif: string = "";

        // Startup a single bet workflow
        if (selection.mode == 'host'){
            // select appropriate private key for bet
            try {
                wif = await chainbet.Wallet.selectViableWIF(wallet);
            } catch(e) {
                console.log("\nNo viable addresses to use, please add funds or wait for 1 confirmation.");
            }

            if(wif != "")
            {
                var betAmount: number = 1500;
                if(!context.debug){
                    console.log('\n');
                    let answer: any = await inquirer.prompt([{
                        type: "input", 
                        name: "amount", 
                        message: "Enter bet amount (1500-10000): ",
                        validate: 
                            function(input: string){ 
                                if(parseInt(input)) 
                                    if(parseInt(input) >= 1500 && parseInt(input) <= 10000) return true; 
                                return false; 
                            }
                        }]);
    
                    betAmount = parseInt(answer.amount);
                }

                var bet = new chainbet.CoinFlipHost(wif, betAmount, chainfeed);
                bet.run();
                while (!bet.complete) {
                    await chainbet.Utils.sleep(250);
                }
            }
        }
        else if (selection.mode == 'client') {
            // select appropriate private key for bet
            try {
                var wif = await chainbet.Wallet.selectViableWIF(wallet);

            } catch(e) {
                console.log('\nNo viable addresses to use, please add funds or wait for 1 confirmation.');
            }

            if(wif != ""){
                var bet = new chainbet.CoinFlipClient(wif, chainfeed, context.debug);
                bet.run();
                while (!bet.complete) {
                    await chainbet.Utils.sleep(250);
                }
            }
        }
        else if (selection.mode == 'withdraw') {
            console.log("withdrawing funds...");
            let answer: any = await inquirer.prompt([{
                type: "input", 
                name: "address", 
                message: "Enter a withdraw address: ",
                validate: 
                    function(input: string){ 
                        if(BITBOX.Address.isCashAddress(input) || BITBOX.Address.isLegacyAddress(input)) 
                            return true; 
                        return false; 
                    }
                }])
            await chainbet.Wallet.sweepToAddress(wallet, answer.address);
        }
        else if (selection.mode == 'list') {
            await chainbet.Wallet.listAddressDetails(wallet); 
        }
        else if(selection.mode == 'quit') {
            process.exit();
        }
        console.log('\n');
        let answer: any = await inquirer.prompt([{type:'input', name:'resume', message:"Press ENTER to continue OR type 'q' to Quit..."}]);
        if(answer.resume == 'q'){
            console.log("\nThanks for visiting Satoshi's Dice!");
            process.exit();
        }
    }
}

async function promptMainMenu() {

    if(!fs.existsSync('./wallet.json')) {
        console.log("\nGenerating a new address and wallet.json file...");
        var wif = chainbet.Utils.getNewPrivKeyWIF();
        fs.writeFileSync('./wallet.json', "", 'utf8');
        jsonfile.writeFileSync("./wallet.json", [{ 'wif': wif }], 'utf8');
    }

    console.log('\n-------------------------------------------------------------------------------');
    console.log("|                        Welcome to Satoshi's Dice!                           |");
    console.log('-------------------------------------------------------------------------------');
    console.log('    =====                   .-------.    ______                       =====');
    console.log('     ///                   /   o   /|   /\\     \\                       ///');
    console.log('     ///                  /_______/o|  /o \\  o  \\                      ///');
    console.log('     ///                  | o     | | /   o\\_____\\                     ///');
    console.log('     ///                  |   o   |o/ \\o   /o    /                     ///');
    console.log('     ///                  |     o |/   \\ o/  o  /                      ///');
    console.log("    =====                 '-------'     \\/____o/                      =====");
    console.log('-------------------------------------------------------------------------------');
    console.log("|                      P2P Gaming with Bitcoin Cash                           |");
    console.log('-------------------------------------------------------------------------------\n');
    
    if(context.mode == undefined){
        return await inquirer.prompt([{
            type: "list",
            name: "mode",
            message: "What do you want to do?",
            choices: [ 
                new inquirer.Separator("Games"),
                { name: '  Roll Dice (ODD wins) - You are Host', value: 'host' },
                { name: '  Roll Dice (EVEN wins) - You wait for a Host', value: 'client' },
                new inquirer.Separator("Wallet Tools"),
                { name: '  List balances', value: 'list' },
                { name: '  Generate new BCH address', value: 'generate' },
                { name: '  Withdraw all funds', value: 'withdraw' },
                { name: '  Quit', value: 'quit' }
            ],
        }]);
    }
    else {
        return { 'mode': context.mode };
    }
}

main();