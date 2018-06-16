# MultiPlayer

# Phase 1: Announcement


OP_RETURN OUTPUT:

| Bytes       | Name         | Hex Value | Description  |
| ------------- |-------------| -----|-----------------|
| 1      | Phase | 0x01  | Phase 1 is "Bet Offer Announcement" |
| 1     | Bet Type | 0x03 | Denotes what kind of bet will be contructed. 0x03 for Multiplayer bet. |
| 8     | Amount   | \<amount> | Bet amount in Satohis for each participant. |  



Phase 2: Acceptance

Phase 3: Player List

Phase 4: Sign Main Funding Transaction

Phase 5: Sign Escrow Funding Transaction

Phase 6: Sign Escrow Refund Transaction

Phase 7: Reveal Secrets
