import React, { useEffect } from 'react';

const App = () => {
  // Existing code

  useEffect(() => {
    // Proper sync initialization on mount
    initializeSync();

    // If new user, fetch all content and notifications
    if (isNewUser) {
      fetchAllContent();
      fetchNotifications();
    }
  }, []);

  const handleLogin = () => {
    // handle login logic and include additional fetches for new users
    if (isNewUser) {
      fetchAllContent();
      fetchNotifications();
    }
    // Existing login logic
  };

  // Existing code
};

export default App;