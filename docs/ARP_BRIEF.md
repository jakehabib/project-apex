# Owner brief: APEX Ranking Points (ARP), tournament invitations and qualification

Received 2026-10-12. This is the owner's requirements document, condensed faithfully. Every requirement is kept. The implementation design is in `COMPETITION_DESIGN.md`.

**Objective:** a comprehensive world ranking, tournament invitation and qualification ecosystem, inspired by Valve Regional Standings but named **APEX Ranking Points (ARP)**. It is a fundamental progression mechanic, not just a leaderboard. The player builds a roster, climbs the rankings, receives prestigious invitations, earns prize money and wins world championships. Rankings influence virtually every part of the competitive calendar.

1. **What ARP represents.** Every eligible roster has an ARP score. Maintain:
   - global, European, Americas and Asian rankings;
   - historical snapshots;
   - peak rankings;
   - movement over time.

   Score determines order, and order determines invitation eligibility. Rank #20 is not automatically invited: that depends on each event's rules, regions, slots and snapshot.
2. **Earning points.** Approximate the VRS ideas: recent prize-money performance, achievements of beaten opponents, and head-to-head results. Consider:
   - match results against credible opponents;
   - opponent strength (beating a top team matters far more);
   - tournament performance and deep runs;
   - recency;
   - strength of schedule (beating weak teams shouldn't eclipse results against elite teams);
   - roster continuity (rankings belong to a competitive core, not the brand).

   No fixed +20/−10 rewards, and no arbitrary Tier 1 bonus: strong events matter through opponent quality and prize money. Use one configurable model for AI and human teams alike. The result must be believable, explainable and testable.
3. **Recalculation and snapshots.** Update periodically and publish official snapshots monthly. Account for:
   - new results;
   - recency;
   - other teams' movement;
   - roster eligibility and continuity;
   - teams entering and leaving the rankings.

   Invitations use a **frozen snapshot** from the event's designated date. For example, a June 15 event uses the April snapshot, so rising later does not earn a retroactive invite, and dropping after accepting doesn't revoke it if the team stays eligible. The game must clearly communicate upcoming cutoffs and the rank likely needed.
4. **Tiers.**
   - **Tier 1:** elite internationals with big prize pools and prestige, invites mostly by ARP, plus qualifiers where configured. Underdogs must be able to emerge.
   - **Tier 2:** regional and international development events with smaller prizes, a mix of invites and qualifiers, and a chance to beat stronger teams. Central to a developing org's career.
   - **Tier 3:** entry-level events with accessible qualification, low prizes and mostly regional play. They establish a record. This is an APEX design category, not an official Valve tier.
   - **World Championship:** twice a year, inspired by Majors. Invitations and stage assignments come from published regional qualification rules, ranking cutoffs and roster eligibility. Winning one has major financial, reputational and historical consequences.
5. **Direct invitations.** Organizers reserve slots for ranked teams; for example, a 16-team event might have 12 ARP invites and 4 qualifier places. Walk the list in order. When a team declines or is ineligible, continue down the list until slots fill. Eligibility covers:
   - region;
   - a valid roster;
   - continuity;
   - no conflicting event;
   - no prior decline for the same event.

   Never pick invited teams at random. Each tournament stores its invitation rules and cutoff so the results can be reproduced.
6. **Open qualifiers matter.** They're the pathway for low-ranked and unranked orgs. For example, 32 teams compete for 2 slots in a Tier 2 event. Qualifiers must be genuinely simulated, never decided by a rating threshold, and upsets must be possible. Qualifying gives *access*, not bonus points. Later results feed the ranking.
7. **Cutoffs create decisions.** For example, a team at #27 facing a top-24 invite cutoff in three weeks must decide: enter a smaller event, sign a player, preserve the roster for continuity, or chase a bigger event? Don't force manual registration for trivial events. Provide smart recommendations, eligibility explanations and optional delegation.
8. **Roster continuity.**
   - At least 3 of the 5 core players must continue to keep the ranking and invitation rights.
   - Replacing 1 or 2 players keeps continuity; replacing 3 at once loses it.
   - Track player identities and historical roster snapshots, not just slot counts.
   - Warn the user before a change endangers an important invitation or ranking.
   - Use explicit lineage rules for transfers between orgs.
   - Never let two rosters keep the same history through an exploit.
9. **Regional rankings.**
   - Regions are Europe, the Americas and Asia, assigned mainly by the players' nationalities and eligibility, not the org's office. A Danish org with a majority-Brazilian roster may be in the Americas.
   - Regional slots follow each event's rules.
   - Global and regional scores come from the same model. For example, #42 globally can be #8 in the Americas.
10. **Scheduling.** A believable mix of regional events, Tier 2, Tier 1, open qualifiers, championship qualification windows and two annual championships. Each tournament stores:
    - announcement date and invitation cutoff;
    - event dates;
    - location and region;
    - tier and prestige;
    - prize pool and participant count;
    - invite allocation and qualifier allocation;
    - eligibility rules;
    - format and stages;
    - the snapshot used;
    - the participating rosters.

    AI teams respond to invites, enter suitable qualifiers and choose events by opportunity, money and schedule. Conflicts and travel costs can matter, but without tedious micromanagement.
11. **UI.**
    - **World Rankings:** global and regional rank, ARP, movement, recent meaningful results, upcoming cutoffs, history chart.
    - **Tournament Calendar:** name, tier, prize, dates, invitation status, qualification path, potential reward. Status labels: Directly Invited / Qualified / Qualifier Available / Invite Pending / Below Cutoff / Ineligible.
    - **Tournament details** explain *why* a team was invited. For example: "Team Alpha received a direct invitation because it was ranked #11 on the official April Global ARP snapshot, within the event's first 12 invitation positions." Or: "Your organization missed the invitation cutoff by three ranking places. An open qualification tournament is available."
    - **Rankings Forecast:** a cautious estimate that distinguishes current rank, published cutoff, historical thresholds and forecasts affected by upcoming events. Never present a guarantee.
12. **AI orgs** use the same ecosystem. They:
    - pursue ranking;
    - protect valuable invitations;
    - enter suitable qualifiers and answer invitations;
    - evaluate roster changes, understanding the 3-player consequence;
    - balance money against prestige.

    Strong orgs prioritise prestigious events; developing orgs seek accessible ones. No points without legitimate results.
13. **Anti-exploit.** Prevent:
    - farming weak teams for elite rankings;
    - points from unranked exhibitions;
    - duplicate histories from transfers;
    - retroactive invitations;
    - invitations for ineligible rosters;
    - infinite points from many low-value matches;
    - top teams keeping elite rank forever without playing.

    Use recency weighting, an opposition evaluation, minimum eligibility and inactivity behaviour. Rankings never depend on reputation or player price.
14. **Core loop.** Start new or weak → accessible competitions → meaningful results → establish ARP → better invitations → prize money and reputation → stronger players → challenge the elite → qualify for world championships → dynasty. No forced repetitive admin.
15. **Implementation.**
    - Inspect existing systems first and extend rather than replace.
    - Build on persistent results and historical snapshots.
    - Work for AI and human orgs over decades.
    - Prioritise correct data relationships, access, continuity and believable progression over copying Valve's formula.
16. **Testing.** Run multi-season simulations and verify:
    - an unranked org can reach elite events;
    - strong teams rise and poor teams decline;
    - invites follow frozen snapshots;
    - ineligible teams are skipped;
    - qualified underdogs reach main stages;
    - replacing 3 core players affects eligibility;
    - regional invites use the right list;
    - AI orgs behave sensibly;
    - no duplicate-record points;
    - rankings stay coherent over 20+ seasons.

    Produce a readable validation report covering distributions, qualification frequency, continuity behaviour and anomalies.

**Final principle:** ARP is not a reward meter. It's the foundation of the competitive ecosystem. Players should care about moving from #70 to #40, from #25 to #20, and from #5 to #1.
