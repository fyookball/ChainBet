# AUCTION
 
A trustless version of an open, ascending price auction can be constructed on the BCH blockchain.  In this context we define trustless to mean that A) the seller is guaranteed to receive the funds from the highest bidder, and B) Only the final, highest paying bidder will be paying; all losing, lower bids will be guarnateed to be returned.   (Note that in this context trustless does not mean the seller is guaranteed to physically deliver the goods being purchased.)

This is accomplished using a set of secrets.  Each time someone is outbid, a secret is revealed that releases funds back to the losing bidder and sets up the next secret for the new high bidder.

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

a) Seller key AND Bob Key AND secret A , where hash(A)= HASH_A (revealing Alice's secret)

OR 

b. by Bob back to himself after some timelock.

The timeout here prevents the seller from disappearing with both Alice's and Bob's money.  Assuming the Seller doesn't dissapear, once the money is in the escrow address, Bob and the Seller will
create a joined transaction sending the money to the normal "Bob Main P2SH".

**Bob Main P22H** 

can be unlocked using:

a) Seller's key AND secret B , where hash(B)= HASH_B. with encumberance till the end of the auction 

or:

b) Bob's key AND secret B , where hash(B)= HASH_B. 

When sending the money from the "Bob temporary escrow" to the  "Bob Main P2SH", Bob will sign first to prevent Alice's secret from being leaked without a certain bid.  Bob's signature is required to move funds from the escrow account so that the funds are certain to go to the proper "Main Bob P2SH".  If this was not a requirement, then for example: the Seller could wait till the auction was over, claim Alice's money, and then also claim Bob's money, revealing Alice's secret but too late for her to use it.

The extra step of creating an escrow address prevents a double spend attack where the Seller reveals Alice's secret at the same time as he accepts Bob's bid, only to have Bob's bid be doublespent.

Note that it would be possible to assemble a hash chain where each secret revealed links to the next:  Alice's secret A when revealed would be equal to hash(B).  B, when revealed would be equal to hash(C), etc.  But there is no immediately obvious benefit.  Each secret can be unrelated to the others.

