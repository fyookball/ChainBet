# MultiPlayer (draft in progress)

## Introduction

Extending the ChainBet protocol to cover bets involving multiple players adds another level of complexity.  The field of study known as [Multi Party Computation](https://en.wikipedia.org/wiki/Secure_multi-party_computation) contains a number of avenues, but not all are suitable for our purpose.

The ideal solution has the following properties:

1. It does not allow cheating via collusion, even against an attacker controlling all adverseries.  
2. It protects an honest participant from losing money, even if a dishonest participant acts irrationally.

This protocol meets those 2 ideals, although it does have the cost of requiring a security deposit of a multiple (N) of the bet amount, where N is the number of participants.  It may be possible to create a different scheme that meets the ideals and has a lower security deposit, but at the cost of added complexity, time, and multiple rounds.  We will not explore such a scheme here.

## Multilock 

We draw our initial inspiration from a multilock idea originally proposed by Kumaresan and Bentov, which offers the principle of  jointly locking coins for fair exchange.  Their proposal requires a protocol change, using the leaves of the Merkle root to get a different transaction ID even if the transaction is unsigned.  

However, a protocol change is not necessary for our purposes.  We can build our solution simply by applying the correct tiering of transactions and time locks.


 






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
| 72 | Signature | \<signature> | Signature spending funds to all escrow addresses. Sigtype hash ALL  |



## Phase 6: Sign Escrow Refund Transaction


| Bytes       | Name         | Hex Value | Description  |
| ------------- |-------------| -----|-----------------| 
| 1      | Phase | 0x03  | Phase 6 is " Sign Escrow Refund Transaction" |
| 32    | Bet Txn Id |\<host_opreturn_txn_id> |This is the bet id that is needed in case Alice or Bob(s) have multiple bets going.| 
| 1     | Signature Index | \<signature index> | A special index used for the purposes of organizing escrow refund signatures.
| 72 | Signature 1 | \<signature> | Signature spending escrow refund transaction. Sigtype hash ALL \|ANYONECANPAY  |
| 72 | Signature 2 | \<signature> | Signature spending escrow refund transaction. Sigtype hash ALL \|ANYONECANPAY  |

 

