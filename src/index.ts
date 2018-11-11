import * as requests from 'request'         //HTTP请求客户端
import * as schedule from "node-schedule"   //定时任务
import * as nodemailer from "nodemailer"    //邮件发送
import { config } from "./config"           //配置文件

let transporter = nodemailer.createTransport({
    service: "hotmail",
    auth: config.auth
});//邮件发送器

/**
 * 定义数据格式
 */
interface TimeLineInfo {
    cover: string
    delay: number
    ep_id: number
    favorites: number
    follow: number
    is_published: number
    pub_index: string
    pub_time: string
    pub_ts: number
    season_id: number
    season_status: string
    square_cover: string
    title: string
}

/**
 * 获取时间轴
 */
function getTimeLine(cb: (error: any, infos?: TimeLineInfo[]) => void = () => { }) {
    //爬取数据
    requests.get("https://bangumi.bilibili.com/web_api/timeline_global", (err, _, body) => {
        if (err) return cb(err)
        //处理数据
        let result = JSON.parse(body)
        //回调错误
        if (result.code != 0) return cb("result code is not 0")
        let infos: TimeLineInfo[] = []
        for (let r of result.result) {
            for (let info of r.seasons) {
                infos.push(info)
            }
        }
        //使用数据
        cb(null, infos)
    })
}

/**
 * 发送邮件
 */
async function sendMail(info: TimeLineInfo) {
    console.log(info)
    let mailOptions = {
        from: '"MgP" <w2xzzpig@hotmail.com>',
        to: config.to.join(", "),
        subject: `${info.title} ${info.pub_index} 更新了`,
        html: `${new Date(info.pub_ts * 1000)}<br/><img src="${info.cover}"/>`
    };
    transporter.sendMail(mailOptions, function (error, response) {
        if (error) {
            console.log("fail: " + error);
        } else {
            console.log("success: " + response.message);
        }
        getTimeLine(setupNodify)
    });
}

/**
 * 设置提醒 
 */
function setupNodify(err: any, infos?: TimeLineInfo[]) {
    //错误处理
    if (err || !infos) {
        console.error(err)
        setTimeout(() => getTimeLine(setupNodify), 5000)
        return
    }
    let t = new Date().getTime()
    //筛选出将来最近一集的剧番
    infos = infos.filter(info => info.pub_ts * 1000 > t).sort((a, b) => a.pub_ts - b.pub_ts)
    let info = infos[0]
    let date = new Date(info.pub_ts * 1000)
    console.log(`${info.title}(${info.pub_index})定时任务已经设置在${date}`)
    //设置提醒
    schedule.scheduleJob(date, () => {
        sendMail(info)
    })
}

getTimeLine(setupNodify)
