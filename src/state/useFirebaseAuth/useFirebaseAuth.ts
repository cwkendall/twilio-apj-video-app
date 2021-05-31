import { useCallback, useLayoutEffect, useState } from 'react';
import * as firebase from 'firebase/app';
import 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
};

export default function useFirebaseAuth() {
  const [user, setUser] = useState<firebase.User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const getToken = useCallback(
    async (user_identity: string, room_name: string, media_region: string) => {
      const headers = new window.Headers();
      const idToken = await user!.getIdToken();
      headers.set('Authorization', idToken);
      headers.set('content-type', 'application/json');

      const endpoint = `${process.env.REACT_APP_BACKEND ?? ''}${process.env.REACT_APP_TOKEN_ENDPOINT}` || '/token';

      return fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_identity,
          room_name,
          media_region,
          create_conversation: process.env.REACT_APP_DISABLE_TWILIO_CONVERSATIONS !== 'true',
        }),
      }).then(res => res.json());
    },
    [user]
  );

  const updateRecordingRules = useCallback(
    async (room_sid, rules) => {
      const headers = new window.Headers();

      const idToken = await user!.getIdToken();
      headers.set('Authorization', idToken);
      headers.set('content-type', 'application/json');

      return fetch(`${process.env.REACT_APP_BACKEND ?? ''}/recordingrules`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ room_sid, rules }),
      }).then(async res => {
        const jsonResponse = await res.json();

        if (!res.ok) {
          const recordingError = new Error(
            jsonResponse.error?.message || 'There was an error updating recording rules'
          );
          recordingError.code = jsonResponse.error?.code;
          return Promise.reject(recordingError);
        }

        return jsonResponse;
      });
    },
    [user]
  );

  useLayoutEffect(() => {
    firebase.initializeApp(firebaseConfig);
    firebase.auth().onAuthStateChanged(newUser => {
      setUser(newUser);
      setIsAuthReady(true);
    });
  }, []);

  const getCredential = (id_token: string, service: string): firebase.auth.AuthCredential | any => {
    return service === 'google'
      ? firebase.auth.GoogleAuthProvider.credential(id_token)
      : service === 'github'
      ? firebase.auth.GithubAuthProvider.credential(id_token)
      : null;
  };

  const getProvider = (service: string): firebase.auth.AuthProvider | any => {
    return service === 'google'
      ? new firebase.auth.GoogleAuthProvider().addScope('https://www.googleapis.com/auth/plus.login')
      : service === 'github'
      ? new firebase.auth.GithubAuthProvider()
      : null;
  };

  const signIn = useCallback((id_token?: string, service: string = 'google') => {
    if (id_token) {
      const credential = getCredential(id_token, service);
      return firebase
        .auth()
        ?.signInWithCredential(credential)
        .then(newUser => {
          setUser(newUser.user);
        })
        .catch((error: any) => {
          // Handle Errors here.
          const errorCode = error.code;
          const errorMessage = error.message;
          console.log(errorCode);
          console.log(errorMessage);
          throw error;
        });
    }
    const provider = getProvider(service);

    return firebase
      .auth()
      .signInWithPopup(provider)
      .then(newUser => {
        setUser(newUser.user);
      })
      .catch(error => {
        // Handle Errors here.
        const errorCode = error.code;
        const errorMessage = error.message;
        console.log(errorCode);
        console.log(errorMessage);
        throw error;
      });
  }, []);

  const signOut = useCallback(() => {
    return firebase
      .auth()
      .signOut()
      .then(() => {
        setUser(null);
      });
  }, []);

  return { user, signIn, signOut, isAuthReady, getToken, updateRecordingRules };
}
