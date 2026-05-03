import dayjs from 'dayjs';

export const main = async (req, res) => {
  console.log('Main');
  res.json({
    success: true,
    message: 'Hi!',
    data: {date: dayjs().format('DD MMM YYYY, HH:mm:ss')},
  });
};
