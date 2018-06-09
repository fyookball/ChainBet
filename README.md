# ChainBet

## Abstract

ChainBet is a proposed Bitcoin Cash protocol to enable on-chain betting.  This initial proposal focuses on a simple coin flip bet, but the principles could be extrapolated to enable more elaborate configurations.  The protocol consists of 2 components: a commitment scheme to enable a trustless wager, and an on-chain messaging system to facilitate communication. 

## Motivation

Since paleolithic times, humans have engaged in games of chance, and probably always will.  Blockchain technology can increase the fairness, transparency, and safety of these activities.  The Bitcoin Cash ecosystem can gain more users and more transaction volume by providing a trustless gaming mechanism.

## Summary

To perform a trustless coinflip wager, Alice and Bob should each create secret values.  If the sum of the values is even, Alice wins the bet.  If the sum of the values is odd, Bob wins the bet.  Alice and Bob will use a cryptographic  scheme where both parties can lock in the bet and reveal their secrets fairly.

In addition, there is a messaging component of the protocol so that the parties do not have to send any extraneous communication through the internet.  They can use the blockchain for everything.  Moreover, multiple parties can participate and match themselves into coinflip betting pairs, thus creating a virtual casino that functions nearly entirely on the blockchain.  

An app will still be required on the user end to use the protocol, to send transactions from the users’ addresses.
 
# Commitment Scheme

Alice and Bob begin by each creating secret values, and then creating a hash of those values which serve as cryptographic commitments.

The scheme is based on a multisignature address and the idea that Bob has the responsibility to claim his winnings after learning Alice’s secret.  If he does not, Alice would be able to claim a win by default based on a time lock.  The default win would be necessary since Bob would be motivated to do nothing (keep his secret a secret) once he discovers he has lost the bet.

But there is a flaw: What compels Alice to reveal the secret, knowing she would be guaranteed to win by “time out” if she doesn’t?  Note that Alice’s secret can’t be part of the multisignature script because Bob would then know it before he has committed funds.  And there is no apparent way to allow Bob to cancel the script if Alice doesn’t share her secret since he could always claim it wasn’t shared if he sees a loss.

To solve this problem, we add some extra steps prior to funds hitting the main multisignature smart contract.  Alice will first move her funds to a special address that requires revealing her secret to spend.  Then Bob will create a joined transaction, signing his piece first -- revealing his hash but not his secret.  Alice will sign and broadcast the transaction, revealing her secret and sending both parties’ funds to the main multisignature address.  Finally, Bob can uncover the outcome of the bet.

We can detail the entire commitment scheme as follows:


**Step 0.** Alice and Bob create secret values A, and B, respectively.  They then create hashes of these: Hash-A and Hash-B, and exchange hashes.

**Step 1.** Alice creates special address A1 and funds it.  A1 has a locking script that requires Alice’s signature as normal, but additionally requires a value (secret A) that hashes to Hash-A.

**Step 2.** Alice creates a smart contract address S1 that can be unlocked if…

Alice can sign for her public key AND Hash(a)= HASH-A AND Hash(b)=HASH-B AND       a+b is an even number.

...or if Bob can sign for his public key AND Hash(a)= HASH-A AND Hash(b)=HASH-B AND       a+b is an odd number.

...or if Alice can sign for her public key and the transaction is more than an hour old.
 
**Step 3.** Bob deterministically ,independently creates S1 and verifies the script hash matches Alice’s S1.

**Step 4.** Bob creates a transaction (T1) spending Alice’s funds from A1 to S1 and from Bob’s address (B1)  to S1.  He signs his input over all outputs with SIGHASH type ALL|ANYONECANPAY.  (Note that it is critical that Alice waits for Bob to sign first so that he does not discover her secret.)  He gives the signature to Alice.

**Step 5.** Alice then signs (T1) , revealing the secret value “A”.

**Step 6.** The funds are now in the multisignature address.  Bob knows the secret A and , using his own secret, can determine if he won or lost.  If he won, he can claim the funds.  If he lost, he can reveal his secret as a courtesy and allow Alice to claim the funds immediately.  If he does not extend this courtesy, Alice can claim the funds by default after 1 hour.

# Messaging Phases

Finding coinflip partners can happen using OP_RETURN based blockchain messages.  A nonce system can be used for announcement and coordination of pairing.   Once an Alice-Bob pair is established, the participants can send minimally sized (i.e. 1 satoshi or dust limit) transactions to each other to continue the communication.

Note that the enumeration of message descriptions below does not correspond exactly to the above steps in the commitment scheme because the communication messages are a separate part of the protocol.

Messaging will consist of 5 several communication phases.

## Phase 1: Announcement

Announcement messages indicate the intention to participate in a wager.  A nonce is used for general ordering and is set by checking the last seen nonce and incrementing.  The wager amount is also specified.

## Phase 2: Acceptance

If Alice and Bob have a “matching” set of nonces (for example 100 and 101), then they can each indicate acceptance of the wager by sending a transaction to each other containing the hash of their secret.

## Phase 3: Alice funding

This message allows Alice to tell Bob she is proceeding with the wager, and the P2SH of the address she has created in accordance with the commitment scheme.  Bob should deterministically verify this address.

## Phase 4: Bob signing

This message allows Bob to pass to Alice the signature needed for the funding transaction, in accordance with the commitment scheme.

## Phase 5: Bob resignation

If Bob realizes he lost the bet, he can message Alice to allow her to quickly claim her winnings.  If Bob loses but does not send this message, Alice will eventually claim the winnings using the timeout.

# Message Detail

## Message 1a (Alice Announcement)

OP_RETURN OUTPUT:

| Bytes       | Name          | Description  |
| ------------- |-------------| -----|
| 4     | Protocol prefix identifier | TBD |
| 1     | Version      |   Protocol can be modified in the future. |
| 6 | Nonce      |    Arbitrary sequence number |
| 1 | Modulus      |    Reduces collisions |
| 1 | Phase      |   1 indicates announcement |
| 8 | Amount      |    Bet amount in satoshis |


## Message 1b (Bob Announcement)

OP_RETURN OUTPUT:

| Bytes       | Name          | Description  |
| ------------- |-------------| -----|
| 4     | Protocol prefix identifier | TBD |
| 1     | Version      |   Protocol can be modified in the future. |
| 6 | Nonce      |    Arbitrary sequence number |
| 1 | Modulus      |    Reduces collisions |
| 1 | Phase      |   1 indicates announcement |
| 8 | Amount      |    Bet amount in satoshis |



## Message 2a (Alice Acceptance)
PRIMARY OUTPUT: MINIMAL AMOUNT SENT TO BOB

OP_RETURN OUTPUT:

| Bytes       | Name          | Description  |
| ------------- |-------------| -----|
| 4     | Protocol prefix identifier | TBD |
| 1     | Version      |   Protocol can be modified in the future |
| 6 | Nonce      |    Arbitrary sequence number |
| 1 | Modulus      |    Reduces collisions |
| 1 | Phase      |   2 indicates acceptance |
| 32 | Hash       |   Hash of secret number |
| 8 | Amount      |    Bet amount in satoshis |




## Message 2b (Bob Acceptance)
PRIMARY OUTPUT: MINIMAL AMOUNT SENT TO ALICE

OP_RETURN OUTPUT:

| Bytes       | Name          | Description  |
| ------------- |-------------| -----|
| 4     | Protocol prefix identifier | TBD |
| 1     | Version      |   Protocol can be modified in the future |
| 6 | Nonce      |    Arbitrary sequence number |
| 1 | Modulus      |    Reduces collisions |
| 1 | Phase      |   2 indicates acceptance |
| 32 | Hash       |   Hash of secret number |
| 8 | Amount      |    Bet amount in satoshis |




## Message 3 (Alice Funding)
PRIMARY OUTPUT: MINIMAL AMOUNT SENT TO BOB

OP_RETURN OUTPUT:

| Bytes       | Name          | Description  |
| ------------- |-------------| -----|
| 4     | Protocol prefix identifier | TBD |
| 1     | Version      |   Protocol can be modified in the future |
| 6 | Nonce      |    Arbitrary sequence number |
| 1 | Modulus      |    Reduces collisions |
| 1 | Phase      |   3 indicates funding |
| 32 | Hash       |   Hash of secret number |
| 20 | P2SH addr    |    Built deterministcally |



## Message 4 (Bob Signing)
PRIMARY OUTPUT: MINIMAL AMOUNT SENT TO ALICE

OP_RETURN OUTPUT:

| Bytes       | Name          | Description  |
| ------------- |-------------| -----|
| 4     | Protocol prefix identifier | TBD |
| 1     | Version      |   Protocol can be modified in the future |
| 6 | Nonce      |    Arbitrary sequence number |
| 1 | Modulus      |    Reduces collisions |
| 1 | Phase      |   4 indicates signing |
| 20 | P2SH addr    |    Built deterministcally |
| 73 | Signature | Sighash ALL|ANYONECANPAY |


Note: After phase 4, no more special communication messages are required.  At this point, Alice will have received Bob’s signature and she can fully construct and broadcast the funding transaction, revealing her secret.  Bob will then claim the funds if he wins.  If he does not claim a win within the allotted time, Alice will claim the funds by default.  

Optionally (but recommended), Bob can be a gracious loser and send a resignation message revealing his secret to Alice, enhancing the user experience.



## Message 5 (Bob Resignation)
PRIMARY OUTPUT: MINIMAL AMOUNT SENT TO ALICE

OP_RETURN OUTPUT:

| Bytes       | Name          | Description  |
| ------------- |-------------| -----|
| 4     | Protocol prefix identifier | TBD |
| 1     | Version      |   Protocol can be modified in the future. |
| 6 | Nonce      |    Arbitrary sequence number |
| 1 | Modulus      |    Reduces collisions |
| 1 | Phase      |   5 indicates resignation |
| 32| Secret value    |  Actual secret after loss| 

# Use of Modulus to Reduce Collisions

Finding partners to wager is handled with the nonce.  In the case when protocol usage is modest, an Alice can send an announcement message with an even numbered nonce and a Bob can join with a corresponding (incremented) odd numbered nonce.

**In the basic usage, Alice is always assumed to be even, and the Alice nonce must always be 1 less than the Bob nonce.  (10 , 11) is valid but (11, 12) is invalid.**

If usage were to accelerate, this system would break down because of multiple participants frequently using the same nonces.

For this, we can use the Modulus field.  With a value below 3, the optional functionality is ignored.  For values 3 or higher, we use a different scheme:  Given the Modulus field **m** and nonce **n**, n  should be matched with the next highest number **v**  where n mod m = v nod m.

For example, if Modulus field is 3, then nonce 12 Alice should be paired with nonce 15 Bob, 13 pairs with 16, and so on. For Modulus field 4, nonce 12 pairs to 16, 13 pairs to 17, etc.

The general idea is that when participants are being added quickly, they should “space themselves out”.  More thought should be put into the details of how this would be implemented in practice.

# Implementation Considerations

Here is a (probably incomplete) list of thoughts and considerations:

1. Applications implementing the protocol need to look at the mempool to read the announcements.  Mempool alone (rather than going back to prior blocks) should be sufficient to find players once the protocol has some usage.

2. The highest nonce should normally be used but there needs to be logic to handle gaps in the situation when a bad actor makes a large jump.

3. Note that the use of a separate “acceptance” step can eliminate collisions.

4. When Modulus > 3 , the lower number is always assumed to be Alice.  

5. Alice always wins the bet on “even” (regardless of nonce)

6. Direct messages between participants  make blockchain scanning minimal.


7. In the case Bob disappears after Alice creates the funding address A1, she can probably still use the address in the next round.

8. Participants need to check for double spends.

9. Some data passed between participants is redundant (for example the secret hash value is passed in the funding round, but it makes implementation easier and also supports simultaneous bets with the same partners.  Things can be made more efficient in future versions.

10. Messaging address public keys will be assumed for the smart contract.

11. In the case that Alice doesn’t publish the transaction in a timely manner following Bob’s signing, Bob should sweep the funds back soon to reclaim them and  so he doesn’t have to worry about keeping his application online.  

12. Participants need to be online generally.

13. It is important that Bob can deterministically generate that which he needs.  We assume the current blockheight is used in reference to the timelocks.

14. The bet amounts need to match (obviously)

15.  The secret values chosen must be large enough to avoid rainbow table attacks.



 
