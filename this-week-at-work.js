// Configuration Parameters
const config = {
    defaultCalendarName: '', // Set your default calendar name here, if any. If blank, it will prompt for it
    tags: ['work', 'weeklyupdate'], // Default tags for new drafts
    skipCalendar: false, // Set to true to skip calendar event selection
    archivePreviousDraft: true // Set to false if the previous draft should not be archived
};

// Initialize configuration
function initConfig() {
    if (typeof config.defaultCalendarName !== 'string') config.defaultCalendarName = '';
    if (!Array.isArray(config.tags)) config.tags = ['work', 'weeklyupdate'];
    if (typeof config.skipCalendar !== 'boolean') config.skipCalendar = false;
    if (typeof config.archivePreviousDraft !== 'boolean') config.archivePreviousDraft = true;
}

// Helper functions for date handling
function getPreviousMonday() {
    let today = new Date();
    let day = today.getDay();
    let diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.setDate(diff));
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function formatEventDate(date) {
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
}

// Draft management functions
function createTitleSection(dateString) {
    return `# This week at work ${dateString}\n`;
}

function buildTodosSection() {
    let todosSection = "\n\n## Todos\n\n";
    let previousDraft = findPreviousDraft();
    let uncheckedItems = [];

    if (previousDraft) {
        let lines = previousDraft.content.split('\n');
        lines.forEach(line => {
            if (line.startsWith("- [ ]")) {
                uncheckedItems.push(incrementCarryOver(line));
            }
        });
    }

    if (uncheckedItems.length === 0) {
        uncheckedItems.push("- [ ] ");
    }

    todosSection += uncheckedItems.join('\n') + '\n';
    return todosSection;
}

function incrementCarryOver(item) {
    const carryOverRegex = /\((\d+)\)$/;
    if (carryOverRegex.test(item)) {
        return item.replace(carryOverRegex, (_, n) => `(${parseInt(n) + 1})`);
    }
    return item + " (1)";
}

function buildUpdatesSection(dateString) {
    let updatesSection = `\n\n## Updates ${dateString}\n\n`;
    if (config.skipCalendar) {
        return updatesSection;
    }

    let events = promptForCalendarEvents();
    let updates = events.map(event => `- Meeting: ${event.title} - ${formatEventDate(event.startDate)}\n`);
    updatesSection += updates.join('');
    return updatesSection;
}

function findPreviousDraft() {
    return Draft.query("", "inbox", config.tags, [], "created DESC").find(d => d.content.startsWith("# This week at work"));
}

function processPreviousDraft() {
    let previousDraft = findPreviousDraft();
    if (!previousDraft) return;

    let lines = previousDraft.content.split('\n');
    let completedItems = [];

    lines.forEach(line => {
        if (line.startsWith("- [x]")) {
            completedItems.push(`- Completed item: ${line.replace("- [x] ", "")}`);
        }
    });

    if (completedItems.length > 0) {
        previousDraft.content += '\n' + completedItems.join('\n');
        previousDraft.update();
    }

    previousDraft.isFlagged = false;
    if (config.archivePreviousDraft) {
        previousDraft.isArchived = true;
    }
    previousDraft.update();
}

function promptForCalendarEvents() {
    let calendar = selectCalendar();
    if (!calendar) {
        console.log("No calendar selected or operation cancelled.");
        return [];
    }

    let startDate = getPreviousMonday();
    let endDate = new Date(startDate.getTime());
    endDate.setDate(endDate.getDate() + 7);

    let events = calendar.events(startDate, endDate);
    let prompt = new Prompt();
    prompt.title = "Select Events for Updates";
    prompt.message = "Check the events you want to include in the 'This week at work' draft.";
    prompt.addSelect("selectedEvents", "Select Events", events.map(e => `${e.title} - ${formatEventDate(e.startDate)}`), [], true);
    prompt.addButton("Submit");

    if (prompt.show() && prompt.buttonPressed === "Submit") {
        let selectedEventTitles = prompt.fieldValues["selectedEvents"];
        return events.filter(e => selectedEventTitles.includes(`${e.title} - ${formatEventDate(e.startDate)}`));
    } else {
        console.log("Event selection cancelled.");
        return [];
    }
}

function selectCalendar() {
    if (config.defaultCalendarName) {
        return Calendar.find(config.defaultCalendarName);
    }

    let prompt = new Prompt();
    prompt.title = "Select Calendar";
    prompt.message = "Choose a calendar to use for pulling events.";

    let calendars = Calendar.getAllCalendars();
    calendars.forEach(calendar => {
        prompt.addButton(calendar.title);
    });

    if (prompt.show()) {
        config.defaultCalendarName = prompt.buttonPressed;
        return Calendar.find(config.defaultCalendarName);
    }
    return null;
}

// Main execution flow
function main() {
    initConfig();

    let previousMonday = getPreviousMonday();
    let dateString = formatDate(previousMonday);
    let newDraft = Draft.create();

    // Create Title Section
    newDraft.content = createTitleSection(dateString);

    // Build and Append Todos Section
    let todosSection = buildTodosSection();
    newDraft.content += todosSection;

    // Build and Append Updates Section
    let updatesSection = buildUpdatesSection(dateString);
    newDraft.content += updatesSection;

    // Update the new draft
    config.tags.forEach(tag => newDraft.addTag(tag));
    newDraft.isFlagged = true;
    newDraft.update();

    // Process Previous Draft
    processPreviousDraft();

    // Load the new draft in the editor
    editor.load(newDraft);
}

main();
