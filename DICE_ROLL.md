# DICE ROLL (draft)

## Summary
Extending the ChainBet protocol to go beyond a simple coin flip can begin with dice.  Games like craps offer many different kinds of bets.  Here we will focus on a simple one-time dice roll.  For example, a standard 6-sided die could be rolled and Bob could choose a number at random, say "5".  Alice could then offer Bob bet odds at a 6:1 payout.  Bob can wager 1 BCH and if a 5 is rolled, he will collect 6 BCH from Alice.  If he loses, Alice will collect his 1 BCH.

## Protocol Extension

We can extend the base protocol by introducing a new bet type designating a dice roll.  It can configured to allow:

* different types ('cardinalities') of dice:  6-sided, 12-sided, 20-sided, etc
* different betting odds
* different roles (giving or taking odds)

The changes are fairly modest:

1. Alice needs advertise the bet differently, specifying the parameters of the bet.
2. The participants need to fund the bet according to the parameters chosen.
3. The main betting script should contain changes to handle the bet odds.




 
