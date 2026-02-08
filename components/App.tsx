function handleLogin() {
    // Existing login logic...

    // Fetch all content and notifications for new users
    fetch('/api/content')
        .then(response => response.json())
        .then(data => {
            // Handle fetched content
            console.log('Fetched content:', data);
        })
        .catch(error => console.error('Error fetching content:', error));

    fetch('/api/notifications')
        .then(response => response.json())
        .then(data => {
            // Handle fetched notifications
            console.log('Fetched notifications:', data);
        })
        .catch(error => console.error('Error fetching notifications:', error));
}