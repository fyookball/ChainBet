# AUCTION
 
A trustless version of an open, ascending price auction can be constructed on the BCH blockchain.  In this context we define trustless to mean that A) the seller is guaranteed to receive the funds from the highest bidder, and B) Only the final, highest paying bidder will be paying; all losing, lower bids will be guarnateed to be returned.   (Note that in this context trustless does not mean the seller is guaranteed to physically deliver the goods being purchased.)

This is accomplished using a set of secrets.  Each time someone is outbid, a secret is revealed that releases funds back to the losing bidder while the next secret is created for the new high bidder.

## OPENING BID

Alice creates the opening bid by sending funds to a P2SH script that can be unlocked using:

a) Seller's key AND secret A , where hash(A)= HASH_A, with a timelock encumberance till the end of the auction 

or:

b) Alice's key AND secret A , where hash(A)= HASH_A.  
 
After the opening bid, the Seller is guaranteed to receive Alice's money if there are no more bids.  In other words, if he does nothing but wait for the timelock to expire.  If he reveals secret A prior to that, Alice can take the funds back.

## SUBSEQUENT BIDS

Typically there are more bids. For example, Bob wants to outbid Alice with a higher bid.

Bob will create a similar P2SH to the opening bid, but first will move his funds to a temporary escrow address.

**Bob Temporary Escrow** 

can be unlocked with:

a) Seller key AND secret A , where hash(A)= HASH_A (revealing Alice's secret)

OR 

b. by Bob back to himself after a short time timelock.
 
Normally, once the money is in the escrow address, the seller will send the money to the normal "Bob Main P2SH", revealing Alice's secret that allows her to take her money back while at the same time securing Bob's bid.

**Bob Main P22H** 

can be unlocked using:

a) Seller's key AND secret B , where hash(B)= HASH_B with a timelock encumberance till the end of the auction 

or:

b) Bob's key AND secret B , where hash(B)= HASH_B. 

The process would repeat for Carol, who outbids Bob.  She would set up a temporary escrow address that would then reveal Bob's secret while funds are transferred to the main Carol auction address, and so on.

Finally, when the auction ends, the Seller would claim the funds in the last address used.

## Notes

1. When sending the money from the "Bob temporary escrow" to the "Bob Main P2SH", Bob's signature is not required, which prevents the case of Alice's secret being leaked (allowing her to cancel the bid) while Bob also cancels his bid.   

2. In the case when the Seller does not promptly send the funds from the escrow address to the Bob Main P2SH, Bob should claim the funds back before the auction ends to prevent the seller from obtaining both Alice and Bob's funds.

3. The extra step of creating an escrow address prevents a double spend attack where the Seller reveals Alice's secret at the same time as he accepts Bob's bid, only to have Bob's bid be doublespent.

4. Note that it would be possible to assemble a hash chain where each secret revealed links to the next:  Alice's secret A when revealed would be equal to hash(B).  B, when revealed would be equal to hash(C), etc.  But there is no immediately obvious benefit.  Each secret can be unrelated to the others.

