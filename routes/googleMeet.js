const { oauth2Client, getAuthUrl } = require('../configs/googleoAuth');

// Redirect to Google OAuth2 consent screen
app.get('/auth/google', (req, res) => {
  const authUrl = getAuthUrl();
  res.redirect(authUrl);
});

// Handle Google OAuth2 callback
app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Save tokens to the user's session or database
    req.user.tokens = tokens; // Adjust based on your auth setup
    res.redirect('/'); // Redirect to the frontend
  } catch (error) {
    console.error('Error during Google OAuth2 callback:', error);
    res.status(500).send('Authentication failed');
  }
});