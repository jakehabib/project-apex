"""SWITCHYARD v2 — rail yard map. Run: python3 scripts/maps/switchyard.py [preview.png]

Layout intent
- Attackers: Locomotive Depot (south-east). Defenders: Signal Tower (north centre).
- A Platform (north-east): passenger platform beside a parked train (gaps between carriages
  are shooting lanes). Approaches: Tracks (long, open), Footbridge stairs (from mid),
  CT via Tower Bridge.
- Mid Turntable: circular turntable and a roundhouse with engine bays.
- B Coal Sheds (west): coal heaps, small sheds, a conveyor. Approaches: Coal Road gate
  (long), Boiler House (from mid). CT via the Water Tower path.
"""
import sys
from mapkit import Canvas, circle, ring

c = Canvas()

# ---------------------------------------------------------------- CT: Signal Tower
c.rect(28, 2, 46, 9, 'C')
c.rect(35, 3, 38, 5, '#')              # tower base
c.points([(30, 8), (44, 8)], 'p')
c.rect(41, 3, 43, 4, 'v')              # maintenance car
c.rect(47, 4, 52, 8, '-')              # tower bridge east (metal)
c.rect(8, 4, 27, 8, ':')               # water tower path west
c.points([(10, 5), (13, 5), (10, 7), (13, 7)], 'p')  # water tower legs
c.rect(8, 9, 13, 17, ':')              # path down to B
c.rect(21, 9, 25, 17, ':')             # signal cut: tower yard → B north-east
c.put(23, 13, 'x')
c.points([(9, 12), (12, 15)], 'x')

# ---------------------------------------------------------------- A Platform
c.rect(53, 9, 73, 21, '.')             # platform concourse
c.rect(55, 11, 71, 19, 'A')            # site area on the platform
c.rect(55, 9, 57, 10, '#')             # ticket office corner
c.rect(53, 4, 53, 8, '-')              # bridge lands on the platform
for x in (58, 63, 68):                 # roof columns
    c.put(x, 12, 'p')
c.points([(60, 17), (61, 17), (66, 14), (70, 17)], 'x')   # benches
c.rect(64, 16, 65, 17, 'o')            # kiosk
c.rect(74, 9, 77, 50, ':')             # tracks (gravel bed) east
c.rect(75, 9, 75, 50, 'r')
c.rect(77, 9, 77, 50, 'r')
for y0 in (11, 17, 23, 30):            # parked passenger train on the platform edge: gaps are lanes
    c.rect(72, y0, 73, y0 + 3, 'O')
c.points([(76, 36), (74, 42)], 'x')
c.rect(46, 22, 49, 30, 's')            # footbridge stairs from mid
c.rect(46, 20, 54, 21, '-')            # footbridge deck onto the platform

# ---------------------------------------------------------------- Mid: Turntable and Roundhouse
c.rect(28, 23, 46, 37, ':')
circle(c, 37, 30, 6, 'r')              # turntable deck (rails)
circle(c, 37, 30, 2, 'p')              # central pivot (blocks the long lines)
ring(c, 37, 30, 7, ',')                # turntable pit rim
c.rect(29, 18, 45, 22, '_')            # roundhouse floor
c.rect(29, 18, 45, 18, '#')
for x in (32, 36, 40, 44):             # engine bay walls (openings between)
    c.rect(x, 19, x, 20, '#')
c.put(33, 19, 'v')                      # locomotive nose in a bay
c.rect(36, 10, 39, 17, '.')            # signal alley (CT → mid)
c.rect(36, 18, 39, 18, '.')            # roundhouse north doors
c.put(37, 13, 'x')
c.points([(30, 35), (44, 26), (45, 35)], 'x')
c.rect(44, 23, 45, 24, 'p')            # water crane (breaks the platform–boiler diagonal)

# ---------------------------------------------------------------- B Coal Sheds
c.rect(4, 18, 22, 33, ':')
c.rect(6, 20, 20, 31, 'B')
circle(c, 10, 24, 2, 'o')              # coal heaps
c.points([(16, 27), (17, 27)], 'o')
c.rect(15, 20, 18, 22, '#')            # small shed (solid)
c.rect(4, 26, 5, 29, '#')              # wall stub
c.rect(12, 30, 18, 30, 'h')            # conveyor railing
c.points([(8, 29), (19, 25), (7, 21)], 'x')
c.rect(23, 24, 30, 31, '_')            # boiler house (mid → B), a dog-leg with no straight lines
c.rect(28, 29, 30, 31, '#')            # mid can only enter along the top
c.rect(25, 27, 30, 28, 'o')            # boiler wall; the gap at its west end leads down
c.rect(22, 23, 22, 28, '#')            # solid west wall above the B door
c.rect(22, 29, 22, 31, '.')            # boiler door into B (rows 29-31)

# ---------------------------------------------------------------- T side: Depot, Freight Road, Coal Road, Loading Ramp
c.rect(52, 50, 74, 57, 'T')
c.rect(55, 53, 59, 54, 'O')            # engine shed wagons
c.rect(66, 52, 70, 53, 'v')
c.rect(18, 45, 56, 49, ',')            # freight road west
c.points([(26, 46), (37, 48), (47, 46)], 'x')
c.rect(30, 47, 32, 47, 'o')
c.rect(10, 34, 15, 49, ',')            # coal road north to the gate
c.rect(10, 34, 15, 35, '.')            # coal gate
c.points([(11, 40), (14, 44)], 'x')
c.rect(10, 45, 18, 49, ',')
c.rect(47, 38, 51, 49, ',')            # loading ramp to mid
c.rect(46, 36, 51, 37, ',')
c.put(49, 42, 'x')
c.rect(52, 38, 56, 44, '#')            # warehouse block between ramp and tracks
c.rect(57, 44, 74, 49, ':')            # depot apron joining the tracks
c.points([(62, 46), (69, 45)], 'x')

if __name__ == '__main__':
    c.write_ts('src/core/match/maps/switchyard.layout.ts', 'SWITCHYARD')
    if len(sys.argv) > 1:
        c.preview(sys.argv[1])
