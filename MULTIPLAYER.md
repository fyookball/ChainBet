# MultiPlayer (draft in progress)

## Introduction

Extending the ChainBet protocol to cover bets involving multiple players adds another level of complexity.  The field of study known as [Multi Party Computation](https://en.wikipedia.org/wiki/Secure_multi-party_computation) contains a number of avenues, but not all are suitable for our purpose.

The ideal solution has the following properties:

1. It does not allow cheating via collusion, even against an attacker controlling all adverseries.  
2. It protects an honest participant from losing money, even if a dishonest participant acts irrationally.

This protocol meets those 2 ideals, although it does have the cost of requiring a security deposit of a multiple (N) of the bet amount, where N is the number of participants.  It may be possible to create a different scheme that meets the ideals and has a lower security deposit, but at the cost of added complexity, time, and multiple rounds.  We will not explore such a scheme here.

## Multilock 

We draw our initial inspiration from a multilock idea originally proposed by Kumaresan and Bentov, which offers the principle of  jointly locking coins for fair exchange.  Their proposal calls for a protocol change, using the leaves of the Merkle root to obtain a transaction ID even if transaction is unsigned.  

However, a protocol change is not necessary for our purposes.  We can build our solution simply by applying the correct tiering of transactions and time locks.

## Scheme

First, the main betting address (script) is constructed.  It can spend outputs in either of two ways.  **a)** If all parties sign, or **b)**, if the winner signs and produces all the secrets.  The winner is determined by the modulo method described in the the [dice protocol](https://github.com/fyookball/ChainBet/edit/master/DICE_ROLL.md).  

This betting script is then funded by all participants using a timelocked transaction, producing a transaction hash and a single output.  Each participant needs to contribute (*N \* Bet Amount* ) where N is the number of players.  The total amount of this transaction is therefore ( *N<sup>2</sup> \* Bet Amount*). 

Next, each participant creates an escrow address (script) that can spend outputs in either of two ways.  **a)** if the participant can sign and produce the secret that solves the commitment hash, or **b)** if all parties BUT the participant sign.   For example, if the participants include Alice, Bob, Carol, and Dave (each wagering 1 BCH), then Alice's escrow addrsess can be spent if Alice signs and produces **Secret A** , or if Bob, Carol, and Dave all sign.  This second method also has its own timelock.

The idea behind the escrow address is to allow each player enough time to reveal their secret, but force them to compensate every other player if they do not, since not revealing the secret would make the bet unwinnable by anyone.  This is the reason why the bet multiple is required.

The refund transactions need to be signed prior to funds being committed.  Continuing this example, if Alice defaults then Bob does not want to dependant on Carol and Dave to get his money back, so all 3 (Bob, Carol, and Dave) should sign a transaction spending the funds (3 BCH total) from Alice's escrow address back to themselves, so they are each compensated with 1 BCH.  The same needs to happen for the other player's escrow addresses: Alice, Carol, and Dave need to sign a transaction spending from Bob's escrow, and so on.

In the normal case when no one defaults, Alice will spend the 3 BCH back to herself, revealing her secret, and reducing her exposure to the wager amount of 1 BCH.  The same is true for all participants.

After this, the players create a transaction that spends the output of the main betting script and splits it into N outputs that fund the escrow addresses, with the change going back to itself.  So for 4 players wagering 1 BCH, we start with 16 BCH, which is spent on 4 outputs of 3 BCH each (12 total), and 4 BCH sent back as change.








 
![Scheme](https://raw.githubusercontent.com/fyookball/ChainBet/master/images/multilock-small.png)





## Phase 1: Bet Offer Announcement


NOTE: This unique identifier for this Bet will be the transaction id of the txn containing this phase 1 message, herein referred to as <host_opreturn_txn_id>.

OP_RETURN OUTPUT:

| Bytes       | Name         | Hex Value | Description  |
| ------------- |-------------| -----|-----------------|
| 1      | Phase | 0x01  | Phase 1 is "Bet Offer Announcement" |
| 1     | Bet Type | 0x03 | Denotes what kind of bet will be contructed. 0x03 for Multiplayer bet. |
| 8     | Amount   | \<amount> | Bet amount in Satohis for each participant. |  



## Phase 2: Bet Participant Acceptance
 
NOTE: This transaction ID of the transaction containing this phase 2 message, herein referred to as the <participant_opreturn_txn_id>.

OP_RETURN OUTPUT:

| Bytes       | Name         | Hex Value | Description  |
| ------------- |-------------| -----|-----------------| 
| 1      | Phase | 0x02  | Phase 2 is " Bet Participant Acceptance" |
| 32    | Bet Txn Id |\<host_opreturn_txn_id> | This lets Alice know Bob wants to bet. |
|33    | Bob Multi-sig Pub Key  | \<bobPubKey>| This is the compressed public key that players should use when creating the funding transaction. |
|32  | Committment | <commitment> | Hash of the players' secret| 

## Phase 3: Player List Announcement


| Bytes       | Name         | Hex Value | Description  |
| ------------- |-------------| -----|-----------------| 
| 1      | Phase | 0x03  | Phase 3 is " Player List Announcement" |
| 32    | Bet Txn Id |\<host_opreturn_txn_id> |This is the bet id that is needed in case Alice or Bob(s) have multiple bets going.| 
| 8-88 | Participant Txn List  | \<participant txn list>| The 8 byte tail (least significant bits) of the participant_opreturn_txn_id of each participant other than Alice will be put into a list, sorted, and concatenated. |


## Phase 4: Sign Main Funding Transaction

| Bytes       | Name         | Hex Value | Description  |
| ------------- |-------------| -----|-----------------| 
| 1      | Phase | 0x03  | Phase 4 is " Sign Main Funding Transaction" |
| 32    | Bet Txn Id |\<host_opreturn_txn_id> |This is the bet id that is needed in case Alice or Bob(s) have multiple bets going.| 
| 32 | Transaction Input Id  | \<txIn>| The coin Bob will spend to participate in the bet. |
| 1  | vOut | \<vOut> | The index of the outpoint |
| 72 | Signature | \<signature> | Signature spending Bob's funds to the main bet script. Sigtype hash ALL \| ANYONECANPAY |


## Phase 5: Sign Escrow Funding Transaction

| Bytes       | Name         | Hex Value | Description  |
| ------------- |-------------| -----|-----------------| 
| 1      | Phase | 0x03  | Phase 4 is " Sign Escrow Funding Transaction" |
| 32    | Bet Txn Id |\<host_opreturn_txn_id> |This is the bet id that is needed in case Alice or Bob(s) have multiple bets going.|  
| 72 | Signature | \<signature> | Signature spending funds to all escrow addresses. Sigtype hash ALL \| ANYONECANPAY  |



## Phase 6: Sign Escrow Refund Transaction


| Bytes       | Name         | Hex Value | Description  |
| ------------- |-------------| -----|-----------------| 
| 1      | Phase | 0x03  | Phase 6 is " Sign Escrow Refund Transaction" |
| 32    | Bet Txn Id |\<host_opreturn_txn_id> |This is the bet id that is needed in case Alice or Bob(s) have multiple bets going.| 
| 1     | Signature Index | \<signature index> | A special index used for the purposes of organizing escrow refund signatures.
| 72 | Signature 1 | \<signature> | Signature spending escrow refund transaction. Sigtype hash ALL \|ANYONECANPAY  |
| 72 | Signature 2 | \<signature> | Signature spending escrow refund transaction. Sigtype hash ALL \|ANYONECANPAY  |

 

