import React from 'react';
import { InstagramError } from '../core/error-types';
import { errorDetail, errorTitle } from '../state/error-messages';

interface ErrorScreenProps {
  readonly error: InstagramError;
  readonly recoverable: boolean;
  readonly onReset: () => void;
}

export function ErrorScreen({ error, recoverable, onReset }: ErrorScreenProps) {
  return (
    <section className='error-screen' role='alert'>
      <h2>{errorTitle(error)}</h2>
      <p>{errorDetail(error)}</p>
      {recoverable
        ? <p>You can safely try again in a few moments.</p>
        : <p>Reload the page and verify your account on Instagram before retrying.</p>}
      <button type='button' onClick={onReset}>Back to start</button>
    </section>
  );
}
