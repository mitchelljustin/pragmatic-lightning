FROM node:11.10.1

RUN mkdir /home/app
WORKDIR /home/app

ADD package.json .
ADD yarn.lock .
RUN yarn install

EXPOSE 8000

ADD index.js .
CMD ["node", "index.js"]