export function formatTitle(rawTitle: string): string {
    // Remove anything after ' - '
    const mainTitle = rawTitle.split(' - ')[0];
    // Capitalize each word
    return mainTitle.replace(/\w\S*/g, (txt) =>
        txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
}