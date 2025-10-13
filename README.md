notes 

Next steps for you [to get the email working]:

Provide a real SendGrid API key and from-address via firebase functions:config:set sendgrid.key="YOUR_KEY" sendgrid.from="Arcade Earth Crew <crew@arcade.earth>".
Deploy both functions (firebase deploy --only functions).
Once you’re ready, set up the service-account credentials and Sheet ID configs if you haven’t yet so both the email and sheet mirror run in production.