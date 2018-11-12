var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');


var movie=require('./movie');


var request = require('superagent');
const cheerio = require('cheerio');
var url = 'mongodb://localhost:27017,localhost:27018/books';
var MongoClient = require('mongodb').MongoClient;

var _connectDB = async (callback) => { //先执行_connectDB函数体，决定了函数什么时候怎么执行
  const client = await MongoClient.connect(url, { useNewUrlParser: true, replicaSet: 'rs0' });
  const db = client.db();
  let session = client.startSession()
  if (!db) {
    callback('err', db, session, client)
  } else {
    callback(null, db, session, client)
  }
}


/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});

setTimeout(function () {
  // getHomePage();
  // console.log('开始时间：' + new Date());
}, 1000)

//访问首页我的小书屋
var n=1;
function getHomePage() {
  request
    .get('http://mebook.cc/page/' + n)
    .end((err, res) => {
      if (!err) {
        getHomePageUrl(res);
        n++;
        getHomePage()
      } else {
        console.log(err);
        console.log('结束时间' + new Date());
        throw new Error('请求网页err!');
      }
    })
}
//获取首页中详情页的url
function getHomePageUrl(res) {
  var $ = cheerio.load(res.text)
  var urlArr = [];
  if ($('.page_title').text() == '传说这个页面被青蛙吃掉了……') {
    console.log('over!')
    throw new Error('over！');
  }
  $('.link').each(function (key, val) {
    // console.log($(val).find('a').attr('href'))
    try {
      var url = $(val).find('a').attr('href');
      urlArr.push(url);
      if (urlArr.length <= 0) {
        throw new Error('over！');

      }
    } catch (error) {
      throw new Error('over！');
    }

  });

  for (var i = 0; i < urlArr.length; i++) {
    getDetailPage(urlArr[i], function (err, data) {
      if (!err) {
        insertToDb(data)
        writeTxt(data);
      } else {
        console.log(err);
      }
    });
  }

}
//获取详情页面
function getDetailPage(url, callback) {
  request
    .get(url)
    .end((err, res) => {
      if (!err) {
        var $ = cheerio.load(res.text)
        var lastUrl = $(".downbtn").attr('href');
        if (lastUrl) {
          getLastPage(lastUrl, function (err, data) {
            if (!err) {
              callback(null, data);
            } else {
              callback(err, null)
            }
          });
        } else {
          console.log(n-1);
          callback('未找到详情下载url'+$("#primary").find('.sub').text(), null);
          // throw new Error(n);
        }
      } else {
        callback('未找到详情页面!', null)

      }
    })
}

//解析详情页面，并获取最后的页面
function getLastPage(lastUrl, callback) {
  request
    .get(lastUrl)
    .end((err, res) => {
      if (!err) {
        var $ = cheerio.load(res.text);
        var obj = {};
        $(".desc").find('p').each(function (key, item) {
          if ($(item).text() != '' || $(item).text() != null) {
            // console.log($(item).text());
            // console.log($(item).text().indexOf('文件名称'));
            try {
              if ($(item).text().indexOf('文件名称') != -1) {
                obj.bookName = $(item).text().split('：')[1];
              }
              if ($(item).text().indexOf('网盘密码') != -1) {
                obj.pwd = $(item).text().split('：')[2].substring(0, 4);
              }
            } catch (error) {
              console.log(error);
              console.log($(item).text());
            }
          }
        })
        var downloadUrl;
        try {
          downloadUrl = $('.list').find('a').eq(0).attr('href');
        } catch (error) {
          console.log(error)
        }
        obj.href = downloadUrl;
        obj.time=new Date().getTime();
        callback(null, obj);
      } else {
        callback('请求详情网页err!', null);
      }
    })
}


//将请求的数据添加到数据库
function insertToDb(data) {
  if (data) {
    _connectDB(function (err, newDB, session, client) {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
      });
      newDB.collection('books').insertOne(data, { session }, function (err, data) {
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
    })
  }
}

function writeTxt(data) {
  //写入配置文件
  var configUrl = path.join(__dirname) + 'books.txt';
  var str = '书名：' + data.bookName + '     下载地址：' + data.href + '     网盘密码：' + data.pwd + '   写入时间：' + new Date() + '\r\n';
  fs.writeFile(configUrl, str, { 'flag': 'a' }, function (err) {
    if (err) {
      console.log(err)
    } else {

    };

  })
}
module.exports = router;
