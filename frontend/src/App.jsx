/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react';

const App = () => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {

    registerForPushNotifications();

   
    const handleServiceWorkerMessage = (event) => {
      if (event.data && event.data.type === 'NOTIFICATION_RECEIVED') {
        console.log('Notification received from service worker:', event.data);
        addNotification(event.data.title, event.data.body);
      }
    };

    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, []);

  async function registerForPushNotifications() {
    try {
      const publicKeyResponse = await fetch('http://localhost:7000/api/notifications/publicKey');
      const vapidPublicKey = await publicKeyResponse.text();

      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        await navigator.serviceWorker.register('/sw.js');
      }

      const subscription = await registration?.pushManager.getSubscription();

      if (!subscription) {
        const newSubscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        await sendSubscriptionToServer(newSubscription);
      } else {
        await sendSubscriptionToServer(subscription);
      }
    } catch (error) {
      console.error('Error during push notification registration:', error);
    }
  }


  async function sendSubscriptionToServer(subscription) {
    const installationId = localStorage.getItem('installationId') || crypto.randomUUID();
    localStorage.setItem('installationId', installationId);

    try {
      await fetch('http://localhost:7000/api/notifications/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          installationId,
          endpoint: subscription.endpoint,
          p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')))),
          auth: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth')))),
          expirationTime: subscription.expirationTime || null,
        }),
      });
    } catch (error) {
      console.error('Error sending subscription to server:', error);
    }
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  const addNotification = (title, body) => {
    setNotifications((prevNotifications) => [
      ...prevNotifications,
      { title, body, id: Date.now() },
    ]);
  };

  return (
    <div>
      <h1>Push Notification Demo</h1>
      <p>Registering for push notifications...</p>
      <NotificationPanel notifications={notifications} />
    </div>
  );
};

// Notification panel component
const NotificationPanel = ({ notifications }) => {
  return (
    <div style={styles.panel}>
      {notifications.map((notification) => (
        <div key={notification.id} style={styles.notification}>
          <h4>{notification.title}</h4>
          <p>{notification.body}</p>
        </div>
      ))}
    </div>
  );
};

// Styling for the notification panel
const styles = {
  panel: {
    position: 'fixed',
    top: '20px',
    right: '20px',
    width: '300px',
    maxHeight: '400px',
    overflowY: 'auto',
    backgroundColor: '#f0f0f0',
    padding: '10px',
    borderRadius: '10px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    zIndex: 1000,
  },
  notification: {
    backgroundColor: '#fff',
    padding: '10px',
    marginBottom: '10px',
    borderRadius: '5px',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
  },
};

export default App;
