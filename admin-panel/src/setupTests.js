// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

// jsPDF's PNG decoder expects the browser text codecs in the Jest environment.
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
