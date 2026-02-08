// Updated fetchAllContent to return proper fallback structure instead of null

const fetchAllContent = async () => {
    try {
        const response = await fetch('API_ENDPOINT');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching content:', error);
        // Return a proper fallback structure instead of null
        return { content: [], error: 'Failed to fetch content' };
    }
};

export { fetchAllContent };