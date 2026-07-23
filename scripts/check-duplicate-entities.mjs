/**
 * Sanity-check duplicate entities and whether removing a copy would orphan staff.
 *
 * Usage:
 *   node scripts/check-duplicate-entities.mjs
 *   node scripts/check-duplicate-entities.mjs --json
 */
import pg from "pg";
import {
  loadDatabaseUrl,
  loadDuplicateEntityGroups,
} from "./lib/duplicate-entities.mjs";

const { Pool } = pg;

function parseArgs(argv) {
  return {
    json: argv.includes("--json"),
  };
}

function removalRisk(member) {
  if (member.staffTotal > 0 && member.childCount > 0) {
    return "UNSAFE — has staff and child entities (reassign both before delete)";
  }
  if (member.staffTotal > 0) {
    return "UNSAFE — has staff (would orphan / clear entity unless reassigned)";
  }
  if (member.childCount > 0) {
    return "UNSAFE — has child entities (reparent before delete)";
  }
  return "SAFE — no staff and no child entities";
}

async function main() {
  const { json } = parseArgs(process.argv.slice(2));
  const pool = new Pool({
    connectionString: loadDatabaseUrl(),
    connectionTimeoutMillis: 15000,
  });
  const client = await pool.connect();

  try {
    const baseGroups = await loadDuplicateEntityGroups(client);

    const groups = baseGroups.map((group) => {
      const candidates = group.duplicates.map((member) => ({
        ...member,
        risk: removalRisk(member),
        safeToRemove: member.staffTotal === 0 && member.childCount === 0,
        orphanStaffIfRemoved: member.staffTotal,
      }));

      const safeRemovals = candidates.filter((c) => c.safeToRemove);
      const unsafeRemovals = candidates.filter((c) => !c.safeToRemove);

      return {
        ...group,
        candidates,
        safeRemovals,
        unsafeRemovals,
        hasSafeRemoval: safeRemovals.length > 0,
        blocked: unsafeRemovals.length > 0 && safeRemovals.length === 0,
      };
    });

    const summary = {
      duplicateGroups: groups.length,
      totalDuplicateRows: groups.reduce((sum, g) => sum + g.members.length, 0),
      groupsWithSafeRemoval: groups.filter((g) => g.hasSafeRemoval).length,
      groupsFullyBlocked: groups.filter((g) => g.blocked).length,
      safeEntityIds: groups.flatMap((g) => g.safeRemovals.map((c) => c.id)),
      unsafeEntityIds: groups.flatMap((g) => g.unsafeRemovals.map((c) => c.id)),
      orphanStaffIfUnsafeRemoved: groups.reduce(
        (sum, g) =>
          sum +
          g.unsafeRemovals.reduce(
            (inner, c) => inner + c.orphanStaffIfRemoved,
            0,
          ),
        0,
      ),
    };

    if (json) {
      console.log(JSON.stringify({ summary, groups }, null, 2));
    } else {
      console.log("Duplicate entity sanity check");
      console.log("================================");
      console.log(`Duplicate groups: ${summary.duplicateGroups}`);
      console.log(`Duplicate entity rows: ${summary.totalDuplicateRows}`);
      console.log(
        `Groups with ≥1 safe removal: ${summary.groupsWithSafeRemoval}`,
      );
      console.log(`Groups with no safe removal: ${summary.groupsFullyBlocked}`);
      console.log(
        `Staff that would be orphaned if all UNSAFE copies were deleted: ${summary.orphanStaffIfUnsafeRemoved}`,
      );

      if (groups.length === 0) {
        console.log("\nNo duplicate entities found.");
      }

      for (const group of groups) {
        console.log(
          `\n[${group.categoryCode}] "${group.name}" (parent: ${group.parentName})`,
        );
        console.log(
          `  KEEP id=${group.keeper.id} | staff=${group.keeper.staffActive}/${group.keeper.staffTotal} active/total | children=${group.keeper.childCount}`,
        );

        for (const candidate of group.candidates) {
          const tag = candidate.safeToRemove ? "SAFE" : "UNSAFE";
          console.log(
            `  ${tag} remove id=${candidate.id} | staff=${candidate.staffActive}/${candidate.staffTotal} | children=${candidate.childCount} | ${candidate.risk}`,
          );
          if (!candidate.safeToRemove && candidate.staffTotal > 0) {
            console.log(
              `       → deleting this id would leave ${candidate.staffTotal} staff without this entity (reassign to id=${group.keeper.id} first)`,
            );
          }
        }
      }

      if (summary.safeEntityIds.length > 0) {
        console.log("\nSafe to delete (no staff, no children):");
        console.log(`  ${summary.safeEntityIds.join(", ")}`);
      }

      if (summary.unsafeEntityIds.length > 0) {
        console.log("\nDo NOT delete until staff/children are reassigned:");
        console.log(`  ${summary.unsafeEntityIds.join(", ")}`);
        console.log(
          "\nTo merge staff onto the keeper then delete duplicates:\n  npm run db:merge:duplicate-entities\n  npm run db:merge:duplicate-entities -- --apply",
        );
      }
    }

    process.exitCode = summary.groupsFullyBlocked > 0 ? 2 : 0;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Sanity check failed:", error.message);
  process.exit(1);
});
