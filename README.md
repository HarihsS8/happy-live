# Happy Live Streaming App

A simple video and audio live streaming application built with Node.js, Express, Socket.IO, and WebRTC.

## Features

- Real-time video and audio streaming
- One-to-many broadcasting (one broadcaster, multiple viewers)
- WebRTC-based peer-to-peer connections
- Simple web interface
- **Location-based streaming** - Restricts streaming to users within 50km radius for local community broadcasting

## Prerequisites

- Node.js (version 14 or higher)
- npm

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/HarihsS8/happy-live.git
   cd happy-live
   ```

2. Install dependencies:
   ```
   npm install
   ```

## Usage

1. Start the server:
   ```
   npm start
   ```

2. Open your browser and navigate to `https://localhost:3000`

   **Note**: Since this uses self-signed certificates, your browser will show a security warning. Click "Advanced" and "Proceed to localhost (unsafe)" to continue. This is normal for local development.

3. **Get Your Location**:
   - Click "Get My Location" to enable geolocation
   - Allow the browser to access your location
   - Your coordinates will be displayed

4. To start broadcasting:
   - Click "Start Broadcasting"
   - Allow camera and microphone access
   - Your video will appear in the local video element

5. To join as a viewer:
   - Click "Join Stream"
   - Allow camera and microphone access (required for WebRTC)
   - You will see the broadcaster's stream if you're within 50km
   - If you're too far, you'll receive a location rejection message

## How it Works

- The app uses WebRTC for real-time media streaming
- Socket.IO handles signaling between peers
- One user acts as the broadcaster, others as viewers
- STUN server is used for NAT traversal
- **Location-based streaming**: Uses the Geolocation API to get user coordinates
  - Each broadcaster and viewer must share their location
  - Viewers within 50km of the broadcaster are allowed to connect
  - Viewers outside the radius are rejected automatically
  - Distances are calculated using the Haversine formula

## Troubleshooting

### Camera/Microphone Access Denied
- Ensure your browser has permission to access camera and microphone
- Check that no other application is using the camera
- Try refreshing the page and granting permissions

### Connection Issues
- Make sure both broadcaster and viewers are on the same network or have proper internet connection
- Check browser console for WebRTC errors
- Ensure firewall allows WebRTC traffic

### Video Not Showing
- Verify that the broadcaster has started streaming
- Check if WebRTC connection is established (look for "Peer connection established" in console)
- Try different browsers (Chrome, Firefox recommended)

### Port Already in Use
- Change the PORT environment variable: `PORT=3001 npm start`
- Note: The server will run on HTTPS regardless of the port.

## Development

For development with auto-restart:
```
npm run dev
```

## License

MIT
