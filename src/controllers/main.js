import dayjs from 'dayjs';

export const main = async (req, res) => {
  console.log('Main');
  res.json({
    message: 'Hi!',
    date: dayjs().format('DD MMM YYYY, HH:mm:ss'),
  });
};
