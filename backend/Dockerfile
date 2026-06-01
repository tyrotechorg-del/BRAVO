FROM node:18-alpine

WORKDIR /app

# Install dependencies for audio processing
RUN apk add --no-cache ffmpeg python3 make g++

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Create upload directories
RUN mkdir -p uploads/audio uploads/images uploads/video uploads/waveforms uploads/temp
RUN mkdir -p logs

EXPOSE 5000

CMD ["node", "server.js"]