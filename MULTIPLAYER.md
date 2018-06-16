# MultiPlayer (draft in progress)

## Introduction

This type of bet is a winner-takes-all between multiple players with even chances.

Extending the ChainBet protocol to cover bets involving multiple players adds another level of complexity.  The field of study known as [Multi Party Computation](https://en.wikipedia.org/wiki/Secure_multi-party_computation) contains a number of avenues, but not all are suitable for our purpose.

The ideal solution has the following properties:

1. It does not allow cheating via collusion, even against an attacker controlling all adverseries.  
2. It protects an honest participant from losing money, even if a dishonest participant acts irrationally.

This protocol meets those 2 ideals, although it does have the cost of requiring a security deposit of a multiple (N) of the bet amount, where N is the number of participants.  It may be possible to create a different scheme that meets the ideals and has a lower security deposit, but at the cost of added complexity, time, and multiple rounds.  We will not explore such a scheme here.

## Multilock 

We draw our initial inspiration from a multilock idea originally proposed by Kumaresan and Bentov<sup>1</sup>, which offers the principle of  jointly locking coins for fair exchange.  Their proposal calls for a protocol change, using the leaves of the Merkle root to obtain a transaction ID even if transaction is unsigned.  

However, a protocol change is not necessary for our purposes.  We can build our solution simply by applying the correct tiering of transactions and time locks.

## Scheme

First, the main betting address (script) is constructed.  It can spend outputs in either of two ways.  **a)** If all parties sign, or **b)**, if the winner signs and produces all the secrets.  The winner is determined by the modulo method described in the the [dice protocol](https://github.com/fyookball/ChainBet/edit/master/DICE_ROLL.md).  

The participants then create the **main funding transaction** which funds this script using a timelocked transaction.  Each participant needs to contribute (*N \* Bet Amount* ) where N is the number of players.  The total amount of this transaction is therefore ( *N<sup>2</sup> \* Bet Amount*). 

Next, each participant creates an escrow address (script) that can spend outputs in either of two ways.  **a)** if the participant can sign and produce the secret that solves the commitment hash, or **b)** if all parties BUT the participant sign.   For example, if the participants include Alice, Bob, Carol, and Dave (each wagering 1 BCH), then Alice's escrow addrsess can be spent if Alice signs and produces **Secret A** , or if Bob, Carol, and Dave create an **escrow refund transaction** by all signing.  This second method also has its own timelock.

The idea behind the escrow address is to allow each player enough time to reveal their secret, but force them to compensate every other player if they do not, since not revealing the secret would make the bet unwinnable by anyone.  This is the reason why the bet multiple is required.

The refund transactions need to be signed prior to funds being committed.  Continuing this example, if Alice defaults then Bob does not want to dependant on Carol and Dave to get his money back, so all 3 (Bob, Carol, and Dave) should sign a transaction spending the funds (3 BCH total) from Alice's escrow address back to themselves, so they are each compensated with 1 BCH.  The same needs to happen for the other player's escrow addresses: Alice, Carol, and Dave need to sign a transaction spending from Bob's escrow, and so on.

In the normal case when no one defaults, Alice will spend the 3 BCH back to herself, revealing her secret, and reducing her exposure to the wager amount of 1 BCH.  The same is true for all participants.

After this, the players create the **escrow funding transaction** that spends the output of the main betting script and splits it into N outputs that fund the escrow addresses, with the change going back to itself.  So for 4 players wagering 1 BCH, we start with 16 BCH, which is spent on 4 outputs of 3 BCH each (12 total), and 4 BCH sent back as change.

Once everyone is sure that everyone else signed this main escrow transaction, it is safe to allow the timelock on the main funding transaction to expire.  If the timelock is about to expire and a participant doesn't see that the main escrow transaction is signed (or that not all the escrow refund trasactions have been signed), they can cancel the bet by trivially double spending the input to the main funding transaction since it is still under timelock.

Once the main funding transaction timelock expires and the transaction has at least 1 confirmation, it essentially cannot be doublespent.  It will then require the winner to produce the secret, but there is assurance that a winner will come forward with all the secrets since the participants will lose money if they do not produce their secret.  

The time lock on the refund script should come AFTER the time lock on the main betting script.  Otherwise, the players would be forced to reveal their secrets too early and the bet could be cancelled by double spending.    

## Diagram of Betting Scheme

![Scheme](https://raw.githubusercontent.com/fyookball/ChainBet/master/images/multilock-small.png)


# Betting Phases

## Phase 1: Bet Offer Announcement

Alice announces a multiplayer bet and specifies the amount of the bet.  

NOTE: This unique identifier for this bet will be the transaction id of the txn containing this phase 1 message, herein referred to as <host_opreturn_txn_id>.

OP_RETURN OUTPUT:

| Bytes       | Name         | Hex Value | Description  |
| ------------- |-------------| -----|-----------------|
| 1      | Phase | 0x01  | Phase 1 is "Bet Offer Announcement" |
| 1     | Bet Type | 0x03 | Denotes what kind of bet will be contructed. 0x03 for Multiplayer bet. |
| 8     | Amount   | \<amount> | Bet amount in Satohis for each participant. |  



## Phase 2: Bet Participant Acceptance
 
Next, other players (up to 11 other players) can join the bet.  Hereinafter, we will refer to all other players as "Bob".
Bob(s) need to send their public key and their commitment secret in this phase.

NOTE: This transaction ID of the transaction containing this phase 2 message, herein referred to as the <participant_opreturn_txn_id>.

OP_RETURN OUTPUT:

| Bytes       | Name         | Hex Value | Description  |
| ------------- |-------------| -----|-----------------| 
| 1      | Phase | 0x02  | Phase 2 is " Bet Participant Acceptance" |
| 32    | Bet Txn Id |\<host_opreturn_txn_id> | This lets Alice know Bob wants to bet. |
|33    | Bob Multi-sig Pub Key  | \<bobPubKey>| This is the compressed public key that players should use when creating the funding transaction. |
|32  | Committment | <commitment> | Hash of the players' secret| 


## Phase 3: Player List Announcement

Alice will publish a list of all players.  If there is no list, then things may become confusing based on timing where not everyone is clear on the number of players and who they are. Allowing Alice to pick the list is not a problem since this scheme is collusion proof.  

To save space, Alice will only publish the 8 least significant bytes of each participant_opreturn_tx_id, ignoring the edge case where 2 might have a collision.  The list of these truncated ids will be sorted with the lowest value coming first, and then concatenated to form a byte string that has a length of between 8 and 88 bytes, depending on how many players are in the list. 


| Bytes       | Name         | Hex Value | Description  |
| ------------- |-------------| -----|-----------------| 
| 1      | Phase | 0x03  | Phase 3 is " Player List Announcement" |
| 32    | Bet Txn Id |\<host_opreturn_txn_id> |This is the bet id that is needed in case Alice or Bob(s) have multiple bets going.| 
| 8-88 | Participant Txn List  | \<participant txn list>| The 8 byte tail (least significant bits) of the participant_opreturn_txn_id of each participant other than Alice will be put into a list, sorted, and concatenated. |


## Phase 4: Sign Main Funding Transaction

All participants then deterministically create the betting script and sign the main funding transaction, specifying the input parameters and their signature.

| Bytes       | Name         | Hex Value | Description  |
| ------------- |-------------| -----|-----------------| 
| 1      | Phase | 0x03  | Phase 4 is " Sign Main Funding Transaction" |
| 32    | Bet Txn Id |\<host_opreturn_txn_id> |This is the bet id that is needed in case Alice or Bob(s) have multiple bets going.| 
| 32 | Transaction Input Id  | \<txIn>| The coin Bob will spend to participate in the bet. |
| 1  | vOut | \<vOut> | The index of the outpoint |
| 72 | Signature | \<signature> | Signature spending Bob's funds to the main bet script. Sigtype hash ALL \| ANYONECANPAY |


## Phase 5: Sign Escrow Funding Transaction


All participants then deterministically create the escrow scripts and sign the escrow funding transaction. 

| Bytes       | Name         | Hex Value | Description  |
| ------------- |-------------| -----|-----------------| 
| 1      | Phase | 0x03  | Phase 4 is " Sign Escrow Funding Transaction" |
| 32    | Bet Txn Id |\<host_opreturn_txn_id> |This is the bet id that is needed in case Alice or Bob(s) have multiple bets going.|  
| 72 | Signature | \<signature> | Signature spending funds to all escrow addresses. Sigtype hash ALL \| ANYONECANPAY  |
| 


## Phase 6: Sign Escrow Refund Transaction


All participants then sign the escrow refund transactions, assuming the refund address is that which is generated from the public key of each participant, and assuming the bet id ordering described in phase 3.  Each player will have to generate multiple signatures (one for each other participant).  Because of space, only 2 can fit in each message and thus multiple messages may be required.  

This is the purpose of the signature index.  Bob will send the first message with signature index 0x00, indicating his two signatures will be for the Alice escrow refund transaction and the Carol escrow refund transaction respecitively.  His second message will have signature index 0x01,  indicating Bob's escrow refund transaction.

Note that the players do not have to wait for anything to happen between messages 4 and 5, or between messages 5 and 6.  The only safety requirement is that they double spend their inputs before the first time lock if not all assurances are in place.

| Bytes       | Name         | Hex Value | Description  |
| ------------- |-------------| -----|-----------------| 
| 1      | Phase | 0x03  | Phase 6 is " Sign Escrow Refund Transaction" |
| 32    | Bet Txn Id |\<host_opreturn_txn_id> |This is the bet id that is needed in case Alice or Bob(s) have multiple bets going.| 
| 1     | Signature Index | \<signature index> | A special index used for the purposes of organizing escrow refund signatures.
| 72 | Signature 1 | \<signature> | Signature spending escrow refund transaction. Sigtype hash ALL \|ANYONECANPAY  |
| 72 | Signature 2 | \<signature> | Signature spending escrow refund transaction. Sigtype hash ALL \|ANYONECANPAY  |

## Authors

Jonald Fyookball

\[1]  Kumaresan, Bentov "How to Use Bitcoin to Incentivize Correct Computations"
 
