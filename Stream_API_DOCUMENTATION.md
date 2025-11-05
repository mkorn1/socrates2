# API Documentation

## Overview

The ADK application provides a real-time communication API for interacting with Google ADK (Agent Development Kit) agents. The API supports bidirectional communication using Server-Sent Events (SSE) for streaming responses from the agent to the client, and HTTP POST requests for sending messages from the client to the agent.

### Key Features
- **Real-time streaming**: Receive agent responses via Server-Sent Events (SSE)
- **Text and audio support**: Send and receive both text and PCM audio data
- **Session management**: Sessions are automatically created and maintained per user
- **Connection persistence**: SSE connections can be re-established while maintaining session state

---

## Base URL

The API is served by a FastAPI application. By default, it runs on:
```
http://localhost:8000
```

For production deployments, replace with your actual domain.

---

## Authentication

Currently, the API does not require authentication for MVP. All endpoints are accessible without API keys or tokens. Future versions may implement Firebase Authentication.

---

## Endpoints

### 1. Get Root Page

**Endpoint:** `GET /`

**Description:** Serves the static HTML frontend.

**Response:**
- **Status Code:** `200 OK`
- **Content-Type:** `text/html`
- **Body:** HTML content of `index.html`

**Example Request:**
```bash
curl http://localhost:8000/
```

---

### 2. Connect to SSE Stream

**Endpoint:** `GET /events/{user_id}`

**Description:** Establishes a Server-Sent Events (SSE) connection to receive real-time responses from the agent. This endpoint streams agent responses including text messages and audio data.

**Path Parameters:**
- `user_id` (integer, required): Unique identifier for the user session

**Query Parameters:**
- `is_audio` (string, optional): Set to `"true"` to enable audio mode, `"false"` for text mode. Default: `"false"`

**Response:**
- **Status Code:** `200 OK`
- **Content-Type:** `text/event-stream`
- **Headers:**
  - `Cache-Control: no-cache`
  - `Connection: keep-alive`
  - `Access-Control-Allow-Origin: *`

**Event Format:**
The SSE stream sends events in the following format:
```
data: <JSON_OBJECT>\n\n
```

**Event Types:**

1. **Connection Confirmation**
   ```json
   {
     "connected": true
   }
   ```

2. **Text Response (Partial)**
   ```json
   {
     "mime_type": "text/plain",
     "data": "Partial text response..."
   }
   ```

3. **Audio Response**
   ```json
   {
     "mime_type": "audio/pcm",
     "data": "base64_encoded_audio_data"
   }
   ```

4. **Turn Complete**
   ```json
   {
     "turn_complete": true,
     "interrupted": false
   }
   ```

5. **Interrupted**
   ```json
   {
     "turn_complete": false,
     "interrupted": true
   }
   ```

**Example Request:**
```bash
curl -N http://localhost:8000/events/123?is_audio=false
```

**Example JavaScript Client:**
```javascript
const eventSource = new EventSource('http://localhost:8000/events/123?is_audio=false');

eventSource.onmessage = function(event) {
  const message = JSON.parse(event.data);
  
  if (message.mime_type === 'text/plain') {
    console.log('Text:', message.data);
  } else if (message.mime_type === 'audio/pcm') {
    // Decode and play audio
    const audioData = atob(message.data);
    console.log('Audio received:', audioData.length, 'bytes');
  } else if (message.turn_complete) {
    console.log('Turn complete');
  } else if (message.interrupted) {
    console.log('Turn interrupted');
  }
};

eventSource.onerror = function(error) {
  console.error('SSE error:', error);
  eventSource.close();
};
```

**Session Management:**
- The first SSE connection for a `user_id` creates a new session
- Subsequent connections with the same `user_id` reuse the existing session
- Sessions persist across SSE reconnections
- Each user should use a consistent `user_id` to maintain conversation context

---

### 3. Send Message to Agent

**Endpoint:** `POST /send/{user_id}`

**Description:** Sends a message (text or audio) from the client to the agent. The message is queued and processed by the agent, with responses streamed back via the SSE connection.

**Path Parameters:**
- `user_id` (integer, required): Unique identifier for the user session (must match the `user_id` used in the SSE connection)

**Request Body:**
```json
{
  "mime_type": "text/plain" | "audio/pcm",
  "data": "<text_content>" | "<base64_encoded_audio_data>"
}
```

**Request Body Fields:**
- `mime_type` (string, required): MIME type of the message. Supported values:
  - `"text/plain"`: For text messages
  - `"audio/pcm"`: For PCM audio data (must be base64 encoded)
- `data` (string, required): The message content:
  - For `text/plain`: The plain text message
  - For `audio/pcm`: Base64-encoded PCM audio data

**Response:**
- **Status Code:** `200 OK` (on success)
- **Content-Type:** `application/json`
- **Body:**
  ```json
  {
    "status": "sent"
  }
  ```

**Error Responses:**

1. **Session Not Found** (400 Bad Request)
   ```json
   {
     "error": "Session not found. Please connect via SSE first."
   }
   ```
   *Occurs when attempting to send a message before establishing an SSE connection.*

2. **Unsupported MIME Type** (400 Bad Request)
   ```json
   {
     "error": "Mime type not supported: <mime_type>"
   }
   ```

**Example Request (Text):**
```bash
curl -X POST http://localhost:8000/send/123 \
  -H "Content-Type: application/json" \
  -d '{
    "mime_type": "text/plain",
    "data": "What is 2 + 2?"
  }'
```

**Example Request (Audio):**
```bash
curl -X POST http://localhost:8000/send/123 \
  -H "Content-Type: application/json" \
  -d '{
    "mime_type": "audio/pcm",
    "data": "base64_encoded_pcm_audio_data_here"
  }'
```

**Example JavaScript Client:**
```javascript
async function sendTextMessage(userId, text) {
  const response = await fetch(`http://localhost:8000/send/${userId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mime_type: 'text/plain',
      data: text
    })
  });
  
  const result = await response.json();
  return result;
}

async function sendAudioMessage(userId, audioData) {
  // Convert audio data to base64
  const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioData)));
  
  const response = await fetch(`http://localhost:8000/send/${userId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mime_type: 'audio/pcm',
      data: base64Audio
    })
  });
  
  const result = await response.json();
  return result;
}
```

---

## Communication Flow

### Typical Usage Pattern

1. **Establish SSE Connection**
   ```javascript
   const userId = 123;
   const eventSource = new EventSource(`http://localhost:8000/events/${userId}?is_audio=false`);
   ```

2. **Wait for Connection**
   ```javascript
   eventSource.onopen = () => {
     console.log('Connected, ready to send messages');
   };
   ```

3. **Handle Incoming Messages**
   ```javascript
   eventSource.onmessage = (event) => {
     const message = JSON.parse(event.data);
     // Handle message based on type
   };
   ```

4. **Send Messages to Agent**
   ```javascript
   await sendTextMessage(userId, "Hello, agent!");
   ```

5. **Receive Streaming Responses**
   - Text responses arrive as partial updates via SSE
   - Each partial update appends to the current message
   - When `turn_complete: true` is received, the message is complete

6. **Reconnection Handling**
   ```javascript
   eventSource.onerror = () => {
     eventSource.close();
     // Reconnect after delay
     setTimeout(() => {
       eventSource = new EventSource(`http://localhost:8000/events/${userId}?is_audio=false`);
     }, 1000);
   };
   ```

---

## Data Formats

### Text Messages

**Sending:**
- MIME type: `text/plain`
- Data: Plain text string (UTF-8)

**Receiving:**
- MIME type: `text/plain`
- Data: Plain text string (may arrive as partial updates)
- Partial updates: Multiple SSE events may be received for a single response, each containing a partial text fragment

### Audio Messages

**Sending:**
- MIME type: `audio/pcm`
- Data: Base64-encoded PCM audio data
- Encoding: PCM format (specific sample rate/channels depend on audio configuration)

**Receiving:**
- MIME type: `audio/pcm`
- Data: Base64-encoded PCM audio data
- Decoding: Decode base64 to binary PCM data for playback

**Base64 Encoding Example:**
```javascript
// Encode audio data to base64
function encodeAudioToBase64(audioBuffer) {
  const bytes = new Uint8Array(audioBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Decode base64 to audio data
function decodeBase64ToAudio(base64String) {
  const binaryString = atob(base64String);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
```

---

## Error Handling

### Common Error Scenarios

1. **Session Not Found**
   - **Cause:** Attempting to send a message before establishing SSE connection
   - **Solution:** Always establish SSE connection first, then send messages

2. **Connection Lost**
   - **Cause:** Network interruption or server restart
   - **Solution:** Implement reconnection logic with exponential backoff

3. **Invalid MIME Type**
   - **Cause:** Using unsupported `mime_type` value
   - **Solution:** Use only `text/plain` or `audio/pcm`

4. **Invalid Base64**
   - **Cause:** Malformed base64 string for audio data
   - **Solution:** Ensure proper base64 encoding of audio data

### Error Response Format

All errors return JSON with an `error` field:
```json
{
  "error": "Error message describing what went wrong"
}
```

---

## CORS Configuration

The API is configured to allow cross-origin requests from any origin:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: *`
- `Access-Control-Allow-Headers: *`
- `Access-Control-Allow-Credentials: true`

This allows frontend applications running on different domains/ports to communicate with the API.

---

## Rate Limiting

Currently, there is no rate limiting implemented. Future versions may add rate limiting per `user_id` or IP address.

---

## Session Lifecycle

1. **Session Creation**
   - Triggered by first SSE connection for a `user_id`
   - Session is stored in memory on the server
   - Includes: session object, live request queue, runner, and run configuration

2. **Session Reuse**
   - Subsequent SSE connections with the same `user_id` reuse the existing session
   - Conversation context is maintained across reconnections

3. **Session Persistence**
   - Sessions persist for the lifetime of the server process
   - Sessions are not persisted to disk (in-memory storage)
   - Server restart clears all sessions

4. **Session Cleanup**
   - Currently, sessions are not automatically cleaned up
   - Future versions may implement session timeout/cleanup

---

## Example Complete Integration

### JavaScript/TypeScript Client

```javascript
class ADKClient {
  constructor(baseUrl = 'http://localhost:8000', userId = null) {
    this.baseUrl = baseUrl;
    this.userId = userId || Math.floor(Math.random() * 1000000);
    this.eventSource = null;
    this.onMessage = null;
    this.onError = null;
  }

  connect(isAudio = false) {
    const url = `${this.baseUrl}/events/${this.userId}?is_audio=${isAudio}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      console.log('Connected to ADK agent');
    };

    this.eventSource.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (this.onMessage) {
        this.onMessage(message);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      if (this.onError) {
        this.onError(error);
      }
      // Implement reconnection logic here
    };
  }

  async sendText(text) {
    const response = await fetch(`${this.baseUrl}/send/${this.userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mime_type: 'text/plain',
        data: text
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send message');
    }

    return await response.json();
  }

  async sendAudio(audioData) {
    // Assume audioData is ArrayBuffer or Uint8Array
    const base64Audio = this.arrayBufferToBase64(audioData);
    
    const response = await fetch(`${this.baseUrl}/send/${this.userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mime_type: 'audio/pcm',
        data: base64Audio
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send audio');
    }

    return await response.json();
  }

  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

// Usage
const client = new ADKClient();

client.onMessage = (message) => {
  if (message.mime_type === 'text/plain') {
    console.log('Agent:', message.data);
  } else if (message.mime_type === 'audio/pcm') {
    console.log('Audio received');
  } else if (message.turn_complete) {
    console.log('Turn complete');
  }
};

client.onError = (error) => {
  console.error('Connection error:', error);
};

// Connect and send a message
client.connect(false);
await client.sendText('What is 2 + 2?');
```

### Python Client

```python
import requests
import json
import sseclient
import base64

class ADKClient:
    def __init__(self, base_url='http://localhost:8000', user_id=None):
        self.base_url = base_url
        self.user_id = user_id or str(hash(str(id(self))))
        self.session = requests.Session()
    
    def connect_sse(self, is_audio=False):
        """Connect to SSE stream and return event generator"""
        url = f"{self.base_url}/events/{self.user_id}?is_audio={is_audio}"
        response = self.session.get(url, stream=True)
        client = sseclient.SSEClient(response)
        return client.events()
    
    def send_text(self, text):
        """Send a text message to the agent"""
        url = f"{self.base_url}/send/{self.user_id}"
        payload = {
            "mime_type": "text/plain",
            "data": text
        }
        response = self.session.post(url, json=payload)
        response.raise_for_status()
        return response.json()
    
    def send_audio(self, audio_data):
        """Send audio data to the agent (audio_data should be bytes)"""
        url = f"{self.base_url}/send/{self.user_id}"
        base64_audio = base64.b64encode(audio_data).decode('ascii')
        payload = {
            "mime_type": "audio/pcm",
            "data": base64_audio
        }
        response = self.session.post(url, json=payload)
        response.raise_for_status()
        return response.json()

# Usage
client = ADKClient()

# Connect and listen for events
events = client.connect_sse(is_audio=False)

# Send a message
client.send_text("What is 2 + 2?")

# Listen for responses
for event in events:
    message = json.loads(event.data)
    if message.get('mime_type') == 'text/plain':
        print(f"Agent: {message['data']}")
    elif message.get('turn_complete'):
        print("Turn complete")
        break
```

---

## Notes

- **Session Management**: Use a consistent `user_id` to maintain conversation context across reconnections
- **SSE Reconnection**: Implement automatic reconnection logic for production use
- **Audio Format**: Ensure PCM audio data matches the expected format (sample rate, channels, bit depth)
- **Base64 Encoding**: Always base64-encode audio data before sending
- **Error Handling**: Always check for errors in responses and handle them appropriately
- **Connection Order**: Establish SSE connection before sending messages to avoid "Session not found" errors

---

## Version History

- **v1.0.0** (Current): Initial API implementation with SSE streaming and text/audio support

---

## Support

For issues or questions, please refer to the project's main documentation or open an issue in the project repository.

