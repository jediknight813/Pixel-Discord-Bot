import { Client, IntentsBitField, Collection, Events } from "discord.js";
import { joinVoiceChannel, createAudioResource, createAudioPlayer, NoSubscriberBehavior, VoiceConnectionStatus, getVoiceConnection, entersState } from "@discordjs/voice";
import { Player } from "discord-player";
import { EndBehaviorType, VoiceReceiver } from '@discordjs/voice';
import * as prism from 'prism-media';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream';
import axios from "axios";
import dotenv from 'dotenv';
import path from "node:path";

dotenv.config()
var listening = false


const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
        IntentsBitField.Flags.GuildVoiceStates,
        IntentsBitField.Flags.GuildMessageReactions,
    ]
})


client.on("ready", async (event) => {
    console.log(event.user.username, "is online.")
})


client.on('voiceStateUpdate', async (message, before, after) => {


    // check if bot is in empty channel, leave if it is.

    var botInChannel = false

    const voiceChannel = message.member.voice.channel;

    if (voiceChannel !== null) {

        voiceChannel.members.forEach(user => {
            if (user.id == '1092968685196542012') botInChannel = true
        })


        if (botInChannel == true) {

            const voiceConnection = getVoiceConnection(voiceChannel.guild.id);
            
            if (voiceChannel.members.length <= 1) voiceConnection.destroy()

            const player = createAudioPlayer({
                behaviors: {
                    noSubscriber: NoSubscriberBehavior.Pause,
                },
            });

            voiceConnection.subscribe(player);
            

            await entersState(voiceConnection, VoiceConnectionStatus.Ready, 20e3);
            
            voiceConnection.receiver.speaking.on('start', (userId) => {

                if (listening == true) return

                listening = true

                const receiver = voiceConnection.receiver;
                receiver.subscriptions.clear()

                const opusStream = receiver.subscribe(userId, {
                    end: {
                        behavior: EndBehaviorType.AfterSilence,
                        duration: 1000,
                    },
                });

        
                const oggStream = new prism.opus.OggLogicalBitstream({
                    opusHead: new prism.opus.OpusHead({
                        channelCount: 1,
                        sampleRate: 48000,
                    }),
                    pageSizeControl: {
                        maxPackets: 10,
                    },
                });
            
            
                const filename = "./question.ogg";
            
                const out = createWriteStream(filename);
            
                console.log(`👂 Started recording ${filename}`);
            
                pipeline(opusStream, oggStream, out, (err) => {
                    if (err) {
                        console.warn(`❌ Error recording file ${filename} - ${err.message}`);
                        listening = false
                        
                    } else {
                        console.log(`✅ Recorded ${filename}`);
                        receiver.subscriptions.clear()
                        listening = false
                        handleResponse()
                    }
                });

            })


            const handleResponse = () => {
                const data={filename: '../question.ogg'}
                voiceConnection.receiver.subscriptions.clear()
                const voiceChannel = client.channels.cache.get(message.member.voice.channelId);


                axios.post(process.env.apiUrl+'transcribe', data).then(response => {
                            
                    if (response.data == 'Failed') return
                    const question={question: response.data}

                    const transcribechannel = client.channels.cache.get('1093567420532281456');
                    if (response.data != '') transcribechannel.send(response.data);

                    const response_list = response.data.toLowerCase().replace(/[^a-zA-Z0-9 ]/g, '').split(" ")

                    if (response_list.length > 3  && response_list[2] == "pixel" || response_list[1] == "pixel") {

                        axios.post(process.env.apiUrl+'getPixelResponse', question).then(aiResponse => {
                            const response={response: aiResponse.data}
                            
                            voiceChannel.send(aiResponse.data)

                            axios.post(process.env.apiUrl+'generateAudio', response).then(aiAudioResponse => {
                                const resource = createAudioResource('/Users/connor/projects/Pixel-Discord-Bot/src/response.mp3');
                                player.play(resource);
                            })
                        })
                    }

                }).catch(error => {
                    console.error('transcribe failed');
                });

            }

        
        }
    }

})


client.on('messageCreate', async message => {
    console.log(message.content, message.channelId)


    if (message.content.startsWith('<@1092968685196542012>') && message.channel.name == 'pixel-bot-chat' || message.content.startsWith('<@1092968685196542012>') && message.channel.name == 'pixel-bot-test-chat') { 

        var userMessage = message.content
        userMessage = userMessage.replace("<@1092968685196542012>", "")

        userMessage = "hi pixel "+message.content
        const question={question: userMessage}

        axios.post(process.env.apiUrl+'getTextCommand', question).then(TextCommand => {

            const transcribechannel = client.channels.cache.get('1093567420532281456');
            transcribechannel.send(TextCommand.data);
        

        if (TextCommand.data == 'unknown') {
            message.channel.sendTyping()
            const question={question: message.content}
            axios.post(process.env.apiUrl+'getPixelResponse', question).then(aiResponse => {
                message.reply(aiResponse.data)
            })
        }

        if (TextCommand.data == "make an image") {
            message.channel.sendTyping()
            message.reply("Sure, just give me a minute!")

            const question={question: "make a text to image prompt for this: "+message.content}
            
            axios.post(process.env.apiUrl+'getPixelResponse', question).then(aiPrompt => {
                const question={question: aiPrompt.data}
                transcribechannel.send(aiPrompt.data);

                axios.post(process.env.apiUrl+'getImageToImagePrompt', question).then(TextCommand => {
                    message.reply({files: ['./src/images/1.png']})
                    transcribechannel.send(TextCommand.data);
                })
            })

        }

        if (TextCommand.data == "video search") {

            message.channel.sendTyping()
            const question={question: message.content}

            axios.post(process.env.apiUrl+'getPixelResponse', question).then(aiResponse => {
                message.reply(aiResponse.data)
                const question={question: aiResponse.data}
                axios.post(process.env.apiUrl+'getYoutubeVideo', question).then(url => {
                    message.reply(url.data)
                })

            })

        }


        // if the text command is join channl
        if (TextCommand.data == 'join channel') {
            const voiceChannel = message.member.voice.channel;

            // if the user is not in a voice channel, send an error message
            if (!voiceChannel) {
                message.react('❌');
                return message.reply('You need to be in a voice channel to use this command!');
            }
            
            message.react('👍');

            // join the voice channel
            const voiceConnection = joinVoiceChannel({
                channelId: message.member.voice.channelId,
                guildId: message.guildId,
                adapterCreator: message.guild.voiceAdapterCreator
            })
          }}


        )
    }
})


client.login(process.env.BOTPASSWORD)

