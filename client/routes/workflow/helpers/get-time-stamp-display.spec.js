import moment from 'moment';
import getTimeStampDisplay from './get-time-stamp-display';

describe('getTimeStampDisplay', () => {
  const DATE = '2020-01-01 00:00:00';

  describe('When passed no timestamp', () => {
    it('should return "".', () => {
      const output = getTimeStampDisplay(undefined);

      expect(output).toEqual('');
    });
  });

  describe('When passed a timestamp and index = -1', () => {
    it('should return "".', () => {
      timestamp = moment(DATE);
      const index = -1;
      const output = getTimeStampDisplay(timestamp, index);

      expect(output).toEqual('');
    });
  });

  describe('When passed a timestamp and index = 0', () => {
    it('should return the date string.', () => {
      timestamp: moment(DATE);
      const index = 0;
      const output = getTimeStampDisplay(timestamp, index);

      expect(output).toEqual('Jan 1st 12:00:00 am');
    });
  });
});
