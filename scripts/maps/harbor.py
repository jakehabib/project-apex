"""HARBOR v2 — dockside map. Run: python3 scripts/maps/harbor.py [preview.png]

Layout intent
- Attackers: Freight Gate (south). Defenders: Harbormaster (north centre).
- A Docks (north-west): timber deck on the water. Approaches: Long Pier (long, open
  water views), Market Stairs (short, via Fish Market), Ice House (from mid). CT via
  Harbormaster Walk. Net shed, container stacks and a moored boat give layered angles.
- Mid Crane Yard: container maze under a gantry crane; Crane Lane gantry to CT.
- B Warehouse (north-east, indoor): pallet aisles, forklift, foreman's office window.
  Approaches: Rail Doors (via Rail Cut and the parked train), Cold Storage (from mid).
  CT via Sheds back door and the Loft stairs.
"""
import sys
from mapkit import Canvas

c = Canvas()

# ---------------------------------------------------------------- water
c.rect(0, 0, 4, 59, '~')               # western channel
c.rect(5, 1, 29, 6, '~')               # harbour mouth north of A
c.rect(10, 24, 13, 45, '~')            # inner basin
c.rect(10, 41, 13, 45, '#')            # boat house at the basin's south end (blocks the customs lane view)
c.rect(5, 52, 27, 59, '~')             # south quay water
# jetties poking into the harbour mouth
c.rect(9, 3, 10, 6, '=')
c.rect(18, 4, 19, 6, '=')
c.rect(15, 2, 17, 3, 'v')              # moored boat off the jetty (cover from the water side)

# ---------------------------------------------------------------- T spawn: Freight Gate
c.rect(28, 50, 52, 57, 'T')
c.rect(26, 47, 54, 49, ',')            # gate apron
c.rect(31, 53, 33, 55, 'v')            # trucks
c.rect(46, 52, 48, 54, 'v')
c.rect(38, 56, 42, 57, 'O')            # stacked boxes at the gate
c.points([(29, 50), (51, 50)], 'p')    # gate posts

# ---------------------------------------------------------------- Customs Lane / Long Pier / Market Alley
c.rect(5, 46, 27, 50, ',')             # customs lane
c.rect(5, 51, 27, 51, '=')             # quay edge boardwalk
c.points([(9, 48), (14, 49), (21, 47), (25, 49)], 'x')  # barriers / bollards
c.rect(18, 46, 19, 46, '#')            # booth corner
c.rect(5, 22, 9, 45, '=')              # long pier
c.points([(6, 42), (8, 38), (6, 33), (8, 28), (6, 24)], 'x')  # net crates/bollards along the pier
c.rect(5, 35, 5, 37, 'h')              # pier railing section
c.rect(15, 36, 19, 45, ',')            # market alley
c.points([(16, 41), (18, 38)], 'x')
c.rect(19, 43, 19, 44, 'o')

# ---------------------------------------------------------------- Fish Market
c.rect(14, 27, 30, 35, '_')
for x in (17, 21, 25):                 # stall rows
    c.rect(x, 29, x, 30, 'x')
    c.rect(x, 33, x, 33, 'x')
c.points([(15, 28), (29, 28), (15, 34), (29, 34)], 'p')   # roof columns
c.rect(23, 31, 24, 31, 'x')
c.rect(26, 34, 30, 35, '#')            # back office (solid)
c.rect(14, 23, 17, 26, '_')            # ice room
c.put(15, 24, 'o')
c.rect(20, 22, 23, 26, 's')            # market stairs up to A

# ---------------------------------------------------------------- A Docks
c.rect(5, 7, 28, 21, '=')
c.rect(5, 7, 9, 10, '#')               # net shed (solid shell)
c.rect(6, 8, 8, 9, '.')                # net shed interior
c.rect(9, 8, 9, 9, '.')                # shed door
c.rect(8, 11, 25, 20, 'A')
c.rect(12, 12, 13, 16, 'O')            # container column
c.rect(18, 15, 22, 16, 'O')            # container row
c.rect(16, 9, 17, 9, 'o')
c.points([(9, 18), (10, 18), (24, 13), (15, 19), (23, 19), (20, 11)], 'x')
c.rect(26, 7, 28, 7, 'h')              # waterline railing
c.rect(22, 8, 23, 8, 'p')              # bollards on the quay edge
# Ice House connector: mid → A south-east
c.rect(26, 20, 33, 25, '.')
c.put(28, 22, 'x')
c.rect(31, 20, 33, 21, '#')

# ---------------------------------------------------------------- CT spawn: Harbormaster
c.rect(31, 1, 46, 9, 'C')
c.rect(34, 3, 36, 4, 'v')              # patrol car
c.rect(42, 2, 45, 3, '#')              # harbormaster office block
c.points([(33, 8), (44, 8)], 'p')
c.rect(24, 9, 31, 12, '.')             # harbormaster walk to A
c.rect(46, 2, 76, 7, ':')              # sheds yard
c.points([(51, 3), (52, 3), (63, 6), (64, 6), (70, 3)], 'o')
c.rect(56, 3, 58, 4, 'v')              # forklift parked in the yard

# ---------------------------------------------------------------- Mid: Crane Yard, Crane Lane, Container Stacks
c.rect(31, 26, 49, 37, ':')
c.rect(30, 30, 31, 32, '.')            # fish gate (market ↔ mid)
c.rect(32, 27, 48, 27, 'r')            # crane rails
c.rect(32, 36, 48, 36, 'r')
c.points([(33, 28), (33, 35), (47, 28), (47, 35)], 'p')   # crane legs
c.rect(37, 30, 42, 31, 'O')            # mid container (breaks the long lane)
c.rect(44, 32, 45, 33, 'o')
c.points([(35, 33), (40, 34), (48, 30)], 'x')
c.rect(38, 10, 41, 25, '-')            # crane lane gantry
c.points([(38, 18), (41, 21)], 'h')
c.rect(35, 38, 45, 46, ',')            # container stacks
c.rect(35, 40, 40, 41, 'O')
c.rect(40, 43, 45, 44, 'O')
c.rect(43, 38, 45, 38, 'O')
c.put(37, 45, 'x')

# ---------------------------------------------------------------- B: Warehouse, Rail Cut, Cold Storage
c.rect(56, 9, 75, 24, 'B')
for y in (12, 16):                     # pallet racks forming aisles
    c.rect(62, y, 66, y, 'o')
c.rect(70, 13, 70, 16, 'o')
c.points([(59, 12), (59, 19), (73, 20)], 'p')
c.rect(58, 21, 59, 22, 'v')            # forklift
c.points([(57, 15), (64, 20), (67, 22), (72, 10), (74, 18)], 'x')
c.rect(71, 21, 75, 24, '#')            # foreman's office (solid)
c.rect(71, 20, 72, 20, 'w')            # office window onto the site
c.rect(66, 25, 69, 26, '.')            # rail doors
c.rect(64, 27, 72, 49, ',')            # rail cut
c.rect(66, 27, 66, 49, 'r')
c.rect(70, 27, 70, 49, 'r')
for y0 in (30, 36, 42):                # parked train: wagons with gaps between them
    c.rect(69, y0, 71, y0 + 3, 'O')
c.points([(64, 33), (65, 40)], 'x')
c.rect(50, 47, 72, 51, ',')            # rail cut south to the gate
c.rect(56, 49, 57, 50, 'o')
c.rect(50, 28, 57, 31, '.')            # cold storage corridor
c.rect(50, 18, 55, 27, '_')            # cold room
c.points([(51, 24), (54, 20)], 'x')
c.rect(55, 20, 56, 22, '.')            # cold room door into B
c.rect(58, 8, 60, 8, '.')              # back door from sheds
c.rect(46, 9, 56, 10, '-')             # upper walkway: Harbormaster to B's north-west corner
c.rect(73, 8, 75, 8, 's')              # loft stairs

if __name__ == '__main__':
    c.write_ts('src/core/match/maps/harbor.layout.ts', 'HARBOR')
    if len(sys.argv) > 1:
        c.preview(sys.argv[1])
