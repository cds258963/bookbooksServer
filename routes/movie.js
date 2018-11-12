//电影天堂爬虫


const charset = require('superagent-charset');
const request = charset(require('superagent'));
const cheerio = require('cheerio');
var url = 'mongodb://localhost:27017,localhost:27018/books';
var MongoClient = require('mongodb').MongoClient;
var fs = require('fs');
var path = require('path');

var _connectDB = (callback) => { //先执行_connectDB函数体，决定了函数什么时候怎么执行
    MongoClient.connect(url, { useNewUrlParser: true, replicaSet: 'rs0' }, function (err, client) {
        const db = client.db();
        let session = client.startSession()
        if (err) {

            callback('err', db, session, client)
        } else {
            callback(null, db, session, client)
        }
    });

}
// var Promise=require('Promise');
var n = 1;
setTimeout(function () {
    getMovie()

}, 200)

var getMovie = function () {
    //访问首页

    getPage('http://www.ygdy8.net/html/gndy/dyzz/list_23_' + n + '.html', (pageData) => {
        if (pageData) {

            var listPageUrl = dealPage(pageData);
            // console.log(listPageUrl);
            if (listPageUrl.length <= 0) {
                throw new Error('结束!');
            }
            lastData(listPageUrl);
            console.log(n);
            n++;
            getMovie();

        } else {
            throw new Error('抓取结束!')
        }
    });



}
//请求页面fuc

const getPage = function (url, callback) {
    request
        .get(url)
        .buffer(true)
        .charset('gbk')
        .end((err, res) => {
            if (!err) {
                callback(res.text);
            } else {
                console.log(err);
                console.log('结束时间' + new Date());
                callback(null);
                // throw new Error('请求网页err!');
            }
        })


}
//解析列表页面
const dealPage = function (pageData) {
    var $ = cheerio.load(pageData);
    var listPageUrl = [];
    $('.ulink').each(function (index, item) {
        try {
            listPageUrl.push('http://www.ygdy8.net' + $(item).attr('href'));
        } catch (error) {
            console.log(err)
        }
    })
    return listPageUrl;
}
//解析详情页面
const dealdetailPage = function (detailPageData, callback) {
    var $ = cheerio.load(detailPageData);
    var movieName;
    var href;
    try {
        movieName = $('.title_all').find('font').text();
        href = $('td[bgcolor=#fdfddf]').find('a').attr('href');
    } catch (error) {
        console.log(error);
    }
    var obj = null;
    if (movieName && href) {
        obj = {
            movieName: movieName,
            href: href
        }
    }

    callback(obj);
}
//获取最后的数据
const lastData = function (listPageUrl, callback) {
    for (var i = 0; i < listPageUrl.length; i++) {
        getPage(listPageUrl[i], function (detailPageDate) {
            if (detailPageDate) {
                dealdetailPage(detailPageDate, function (data) {
                    if (data) {
                        insertToDb(data);
                        writeTxt(data);
                    }
                });
            }
        });

    }
}
//将请求的数据添加到数据库
const insertToDb = (data1) => {
    _connectDB(function (err, newDB, session, client) {
        newDB.collection('movies').findOne({ movieName: data1.movieName }, function (err, data) {
            if (data == null) {
                session.startTransaction({
                    readConcern: { level: 'snapshot' },
                    writeConcern: { w: 'majority' },
                });
                newDB.collection('movies').insertOne(data1, { session }, function (err, datainsert) {
                    if (!err) {
                        session.commitTransaction(function () {
                            client.close();
                        })
                    } else {
                        session.abortTransaction(function () {
                            client.close();
                        });
                    }
                })
            } else {
                console.log('已添加：' + data.movieName);
                client.close();
            }
        })

    })

}
//写入配置文件
const writeTxt = (insertData) => {
    var configUrl = path.join(__dirname) + 'movies.txt';
    var str = '电影名：' + insertData.movieName + '     下载地址：' + insertData.href + '   写入时间：' + new Date() + '\r\n';
    fs.writeFile(configUrl, str, { 'flag': 'a' }, function (err) {
        if (err) {

        } else {
            // console.log(n)
            // console.log('suc')
        };
    })
}