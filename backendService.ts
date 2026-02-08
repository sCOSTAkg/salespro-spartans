// Updated fetchAllContent method to return proper fallback data structure instead of null.

async fetchAllContent() {
    try {
        const response = await fetch('/api/content');
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        return data.length > 0 ? data : this.getFallbackData(); // Return fallback data structure
    } catch (error) {
        console.error('Fetch error: ', error);
        return this.getFallbackData(); // Return fallback data in case of error
    }
}

getFallbackData() {
    return [
        { id: 1, title: 'Fallback Content 1', description: 'Default description for fallback 1' },
        { id: 2, title: 'Fallback Content 2', description: 'Default description for fallback 2' }
    ];
}