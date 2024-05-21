/*
 * Script to create a new draft for work todos and updates.
 * 
 * Functionality:
 * 1. Creates a new draft titled "Work todos and updates <current date>".
 * 2. Adds sections for "Todos" and "Updates".
 * 3. Pins the new draft in the "work" workspace.
 * 4. Tags the draft with "work" and "weekly".
 * 5. Carries over any unchecked todo items from the previous draft, and marks the number of times they've been carried over as "c/o X".
 * 6. Deletes the previous draft if it was never modified after creation.
 * 7. Unpins the previous draft if it was modified.
 */

// Get today's date
let today = new Date();
let dateString = today.toISOString().split('T')[0]; // Format the date as YYYY-MM-DD

// Create the new draft
let newDraft = Draft.create();
newDraft.content = `# Work todos and updates ${dateString}\n\n## Todos\n\n`; // Initialize with the Todos section
newDraft.addTag("work");
newDraft.addTag("weekly");
newDraft.isFlagged = true; // Pin the draft
newDraft.update();

// Function to find the previous Monday's draft
function findPreviousMondayDraft() {
    let drafts = Draft.query("", "inbox", ["work"], [], "created DESC");
    for (let d of drafts) {
        if (d.content.startsWith("# Work todos and updates")) {
            return d;
        }
    }
    return null;
}

// Find the previous Monday's draft
let previousDraft = findPreviousMondayDraft();
if (previousDraft) {
    // Check if the previous draft was modified after creation
    if (previousDraft.createdAt.getTime() === previousDraft.modifiedAt.getTime()) {
        // If not modified, delete the previous draft
        previousDraft.isTrashed = true;
        previousDraft.update();
    } else {
        // Carry over unchecked items
        let lines = previousDraft.content.split('\n');
        let uncheckedItems = lines.filter(line => line.startsWith("- [ ]"));
        if (uncheckedItems.length > 0) {
            uncheckedItems = uncheckedItems.map(item => {
                // Check if the item already has a carry over count
                let match = item.match(/\(c\/o (\d+)\)$/);
                if (match) {
                    // Increment the carry over count
                    let count = parseInt(match[1]) + 1;
                    return item.replace(/\(c\/o \d+\)$/, `(c/o ${count})`);
                } else {
                    // Add the carry over count
                    return item + " (c/o 1)";
                }
            });
            newDraft.content += uncheckedItems.join('\n') + '\n';
        }

        // Unpin the previous draft
        previousDraft.isFlagged = false;
        previousDraft.update();
    }
}

// Add a new empty todo item
newDraft.content += "- [ ] \n\n## Updates\n";
newDraft.update();

// Load the new draft in the editor
editor.load(newDraft);
