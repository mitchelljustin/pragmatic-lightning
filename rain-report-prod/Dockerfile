FROM node:11.10.1

RUN mkdir /home/app
WORKDIR /home/app

ADD ../rain-report/package.json .
ADD ../rain-report/yarn.lock .
RUN yarn install

EXPOSE 8000

ADD ../rain-report/index.js .
CMD ["node", "index.js"]