# ChainBet - protocol spec version 0.2

## Abstract

ChainBet is a proposed Bitcoin Cash protocol to enable on-chain betting.  This initial proposal focuses on a simple coin flip bet, but the principles could be extrapolated to enable more elaborate configurations.  The protocol consists of 2 components: a commitment scheme to enable a trustless wager, and an on-chain messaging system to facilitate communication. 

## Motivation

Since paleolithic times, humans have engaged in games of chance, and probably always will.  Blockchain technology can increase the fairness, transparency, and safety of these activities.  The Bitcoin Cash ecosystem can gain more users and more transaction volume by providing a trustless gaming mechanism.

## Summary

To perform a trustless coinflip wager, Alice and Bob should each create secret values.  If the sum of the values is even, Alice wins the bet.  If the sum of the values is odd, Bob wins the bet.  Alice and Bob will use a cryptographic  scheme where both parties can lock in the bet and reveal their secrets fairly.

In addition, there is a messaging component of the protocol so that the parties do not have to send any extraneous communication through the internet.  They can use the blockchain for everything.  Moreover, multiple parties can participate and match themselves into coinflip betting pairs, thus creating a virtual casino that functions nearly entirely on the blockchain.  

An app will still be required on the user end to use the protocol, to send transactions from the users’ addresses.
 
# Commitment Scheme

## Overview

Alice and Bob begin by each creating secret values, and then creating a hash of those values which serve as cryptographic commitments.

The scheme is based on the parties funding a multisignature address and the principle that Bob has the responsibility to claim his winnings after learning Alice’s secret.  If he does not, Alice would be able to claim a win by default based on a time lock.  The default win would be necessary since Bob would be motivated to do nothing (keep his secret a secret) once he discovers he has lost the bet.

But there is a flaw: What compels Alice to reveal the secret, knowing she would be guaranteed to win by “time out” if she doesn’t reveal it?  Note that Alice’s secret can’t be part of the multisignature script because Bob would then know it before he has committed funds.  And there is no apparent way to allow Bob to cancel the script if Alice doesn’t share her secret since he could always claim it wasn’t shared if he sees a loss.

To solve this problem, we add some extra steps prior to the **funding transaction** which moves funds to the primary multiignature address.  Essentially, Alice and Bob jointly create the funding transaction using inputs from both Alice and Bob, with Alice's input coming from a script that requires revealing her secret.  Bob's signatures should be collected first, ensuring that Alice's secret is not revealed prior to Bob committing his funds.  

In addition, we will provide a means of preventing double spend attacks with the use of escrow addresses.

## Escrow Preparation

To prepare, Alice and Bob will each set up a temporary "escrow" address to be used as a holding place before creating the funding transaction.  Both escrow addreses will require both Alice's and Bob's signatures.  Each escrow address will also have its own emergency timelock option to retrieve the funds if one of the parties stops cooperating.

## Alice Escrow Address

The main purpose of Alice's escrow address is to reveal Alice's **Secret A** when spent.  It will require both Alice and Bob's signature plus the secret.  By requiring the secret, it reveals it to Bob, thus fulfilling that part of the commitment scheme.

Alternatively, Alice can retrieve the funds unilaterally after 8 confirmations in the situation when Bob abandonds the betting process.

**Script:**
 
``` 
OP_IF "8 blocks" 
    OP_CHECKSEQUENCEVERIFY <alicePubkey>   
OP_ELSE 
    OP_HASH160 <AliceCommitment> OP_EQUALVERIFY 
    OP_2 <alicePubkey> <bobPubkey> 
    OP_2 OP_CHECKMULTISIG 
OP_ENDIF
```
## Bob Escrow Address

The main purpose of Bob's escrow address is to prevent Bob from double spending.  Once the funding transaction is created, Alice's secret will be revealed.  If Bob sees that he has a loss, he could theoretically attempt to double spend his input to the funding transaction, thereby invalidating it.  

By first moving the funds into escrow and requiring Alice's signature in addition to Bob's to spend, Bob cannot on his own attempt a doublespend.  

Of course, it is necessary for the transaction that funds the escrow account to have at least 1 confirmation before the funding transaction is attempted, because otherwise Bob could doublespend that, invalidating both itself and the child transaction (the funding transaction).

Alternatively, Bob can also retrieve his own funds unilaterally after 8 confirmations in the situation when Alice abandonds the betting process.

**Script:**

```
OP_IF "8 blocks" 
    OP_CHECKSEQUENCEVERIFY <bobPubkey>   
OP_ELSE 
    OP_2 <alicePubkey> <bobPubkey> 
    OP_2 OP_CHECKMULTISIG 
OP_ENDIF
```

## Why Alice's Escrow Needs Bob's Signature

Bob's escrow requires Alice's signature for the simple reason that it prevents Bob from double spending his input to the funding transaction.  However, it is not immediately obvious why Alice should also have Bob's signature, since she is not the one with the easy double spend opportunity: Once the funding transaction happens, Alice's secret is revealed and if Bob won, he could simply avoid any double spend attacks by waiting for the funding transaction to get 1 confirmation before claiming the win.  

However, this is inefficient because it requires more confirmations.  Since funding Bob's escrow account already requires waiting for a confirmation, it makes sense to use that time to prevent Alice's funds from being double spent as well.  This renders it unnecessary for Bob to wait for an additional confirmation after the funding transaction is sent before claiming a win.   
  
## OP_RETURN Communication Messages

The ChainBet protocol operates through 6 phases.  Most phases require a communication message to be sent across the network.  This is accomplished by broadcasting a BCH trasnsaction that contains an OP_RETURN output.  

Each OP_RETURN transaction will be assumed to have outputs going back to the sender's originating address.  The output amount back to the sender will simply be the entire balance (for standard UTXOs) of the sender minus the txn fee.  This approach is simple and it minimizes the impacts to the UTXO set over time, making each OP_RETURN message like a sweep transaction.

The OP_RETURN payload uses this format:

<protocol_id><version_id><phase_value><various_phase_dependent_data> 

The protocol_id is a [standard Terab 4-byte prefix](https://github.com/Lokad/Terab/blob/master/spec/opreturn-prefix-guideline.md) with a value of **0x00424554** (ASCII equivalent of "BET").  Following the Terab guidelines, the operation will utilize a pair of OP_PUSHDATA codes: one for the protocol_id and another for everything else in the payload.

The version_id is a one-byte value that can be used to upgrade the protocol in the future.  Currently, it is **0x01**.  protocol_id and version_id should be present in all OP_RETURN payloads but will be ommitted in the subsequent message detail descriptions.

Note that only Phase 5 does not include an OP_RETURN message but consists of the main funding transaction itself.
 
# Protocol Phases

## Phase 1: Bet Offer Announcement

Alice advertises to the network that she is hosting a bet for anyone to accept.  She will wait until someone responds to accept her bet.
 
NOTE: This unique identifier for this Bet will be the transaction id of the txn containing this phase 1 message, herein referred to as <host_opreturn_txn_id>.


OP_RETURN OUTPUT:

| Bytes       | Name         | Hex Value | Description  |
| ------------- |-------------| -----|-----------------|
| 1      | Phase | 0x01  | Phase 1 is "Bet Offer Announcement" |
| 1     | Bet Type | 0x01 | Denotes what kind of bet will be contructed. 0x01 for Coin flip. |
| 8     | Amount   | \<amount> | Bet amount in Satohis for each participant. | 
| 20   | Alice Commitment | \<commitment> | Alice's commitment so Bob can build Alice's P2SH escrow address |
| 20 | Target Address | \<target> | Optional.  Restricts offer to a specific bet participant. |
 
 
## Phase 2: Bet Participant Acceptance

After Bob detects Alice’s Phase 1 message, Bob responds to Alice’s bet announcement letting Alice know that he accepts her bet.  (there may have been others on the network whom also accept the bet, but Bob happens to be the first to accept her bet)
 
NOTE: This transaction ID of the transaction containing this phase 2 message, herein referred to as the <participant_opreturn_txn_id>.

OP_RETURN OUTPUT:

| Bytes       | Name         | Hex Value | Description  |
| ------------- |-------------| -----|-----------------| 
| 1      | Phase | 0x02  | Phase 2 is " Bet Participant Acceptance" |
| 32    | Bet Txn Id |\<host_opreturn_txn_id> | This lets Alice know Bob wants to bet. |
|33    | Bob Multi-sig Pub Key  | \<bobPubKey>| This is the compressed public key that Alice should use when creating her p2sh input for the bet. |
| 20  | Bob Commitment | \<commitment> | Bob's commitment so Alice can build Bob's P2SH escrow address |
 

## Phase 3: Bet Host Funding

Alice detects Bob's Phase 2 message.  She then prepares her escrow address and funds it.  Then she sends this announcement to Bob, indicating acceptance of the bet with Bob (thus others whom also accepted Alice's original announcement will know that they are being ignored and should look for other bets).

OP_RETURN OUTPUT:

| Bytes       | Name         | Hex Value | Description  |
| ------------- |-------------| -----|-----------------| 
| 1      | Phase | 0x03  | Phase 3 is " Bet Host Funding" |
| 32    | Bet Txn Id |\<host_opreturn_txn_id> |This is the bet id that is needed in case Alice or Bob have multiple bets going.|
| 32  | Participant Txn Id   | \<participant_opreturn_txn_id>| This is Alice's acknowledgement that Bob is the participant. |
| 32 | Host P2SH txid | \<host_p2sh_txid> | (Alice Escrow Address). Bob needs this, so he can verify the Bet Host has committed her funds to the bet, and the bet is real. Bob will also need this so he can also see what Alice’s committed value is once she tries to spend the final bet. |
| 33 | Host Multi-sig Pub Key | \<AlicePubKey> | Bob needs this so he can construct his own P2SH (multisig) input. Bob also needs this so he can deterministically compute the Host's P2SH (multisig with value commitment). |

## Phase 4: Bet Participant Funding

After Bob detects the Phase 3 message from Alice, he will know that he is in fact the bet participant. He can first check that Alice created her P2SH address with the correct amount so he knows the bet is real.

Bob can then create his own (escrow) P2SH address which will be used as an input to the main funding transaction.  Bob funds this address, and announces that he has submitted his P2SH to cover his side of the bet, and passes the signatures for both P2SH addresses to Alice.

Bob should now monitor the network, looking first for the spending of Alice's escrow address in order to see Alice's secret value.  Then he can calculate if we won the bet.
 
OP_RETURN OUTPUT:

| Bytes       | Name         | Hex Value | Description  |
| ------------- |-------------| -----|-----------------| 
| 1      | Phase | 0x04  | Phase 4 is " Bet Participant Funding" |
| 32    | Bet Txn Id |\<host_opreturn_txn_id> |This is the bet id that is needed in case Alice or Bob have multiple bets going.|
| 32  | Participant Txn Id   | \<participant_p2sh_txn_id>|  Alice will need this so she can try to spend Bob’s side of the bet. |
| 72| Participant Signature 1 | \<participant_sig_1>| Bob's signature.  Alice will need this to sign **Bob's** P2SH funds so she can submit the bet transaction to the network. Sigtype hash ALL \| ANYONECANPAY |
| 72| Participant Signature 2 | \<participant_sig_1>| Bob's signature.  Alice will need this to sign **Alice's** P2SH funds so she can submit the bet transaction to the network Sigtype hash ALL \| ANYONECANPAY |

## Phase 5: Funding Transaction

Alice should now have both of Bob's signatures, so she can spend from both escrow addresses to create the (main) funding transaction.  Alice should wait until both escrow transactions have at least one confirmation before broadcasting the funding transaction. Otherwise, she risks a double spend attack where Bob learns her secret, discovers he has lost the bet, and then tries to double spend the input to the Bob escrow account.

Using a shorthand notation where Alice's Secret is "A" and the hash is "HASH_A", and Bob's Secret is "B" and its hash is "HASH_B",
then we can say that the main P2SH address is a script that allows the funds to be spent if:

Alice can sign for her public key AND Hash(A)= HASH_A AND Hash(B)=HASH_B AND A+B is an even number.

...or if Bob can sign for his public key AND Hash(A)= HASH_A AND Hash(B)=HASH_B AND A+B is an odd number.

...or if Alice can sign for her public key and the transaction is more than 4 blocks old.

**Script:**

```
OP_IF 
    OP_IF 
        OP_HASH160 <bobLosingCommitment> OP_EQUALVERIFY 
    OP_ELSE 
        "4 blocks" OP_CHECKSEQUENCEVERIFY OP_DROP 
    OP_ENDIF 
    <alicePubkey> OP_CHECKSIG 
OP_ELSE 
    OP_DUP OP_HASH160 <bobCommitment> OP_EQUALVERIFY 
    OP_OVER OP_HASH160 <aliceCommitment> OP_EQUALVERIFY 
    OP_4 OP_SPLIT OP_DROP OP_BIN2NUM 
    OP_SWAP OP_4 OP_SPLIT OP_DROP OP_BIN2NUM 
    OP_ADD OP_2 OP_MOD OP_0 OP_EQUALVERIFY 
    <bobPubkey> OP_CHECKSIG 
OP_ENDIF
```
The 256 bit secret numbers are converted to signed 32 bit integers using the new OP_SPLIT and OP_BIN2NUM. OP_MOD is also used to determine if the result is even or odd.

By monitoring the blockchain, Bob can determine if he or Alice can claim the funds.   


## Phase 6: Bet Participant Resignation

After Bob detects Alice’s P2SH has been spent Bob will know the final bet transaction has been submitted to the network.  This message reveals Bob’s secret value so that Alice can immediately claim the funds if she won.

This final message is not required for the Smart Contract to function properly.  It is purely to enhance the user experience for Alice if she wins.  If Bob did not send this message after he loses then Alice could still spend the bet after the bet's time lock expires to claim the funds.

 
OP_RETURN OUTPUT:

| Bytes       | Name         | Hex Value | Description  |
| ------------- |-------------| -----|-----------------| 
| 1      | Phase | 0x06  | Phase 6 is " Bet Participant Resignation" |
| 32    | Bet Txn Id |\<host_opreturn_txn_id> |This is the bet id that is needed in case Alice or Bob have multiple bets going.|
| 32  | Secret Value   | \<secret value>| Bob's secret value revelaed to Alice so she can see the math behind the bet's outcome. |
  
  
# Considerations

1. We assume the current blockheight is used when deterministically generating scripts.  
2. 256 bit secrets are required.  Small secrets could be easily brute forced.
3. Implementations can optionally choose not to require that escrow transactions get confirmations.  There is a trade-off of speed vs security which may be acceptable if the double-spend incentives for mining pools are negligible.
4. We considered having messaging transactions send a minimal output between Alice and Bob to allow SPV wallets to more easily implement the protocol but decided that since they must monitor the blockchain for at least one of the components, then it is not adding much cost to continue to do that for all messages.  This is why messaging transactions send back to themselves.  Participants need to monitor OP_RETURN for all phases.
5. We recommend that implementations spend the winning bet to the originating P2PKH address that created the original OP_RETURN advertisement or acceptance.


## Authors

Jonald Fyookball

James Cramer

Chris Pacia

 
 
