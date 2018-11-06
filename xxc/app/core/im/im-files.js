import {getChatMessages} from './im-chats';
import profile from '../profile';
import API from '../../network/api';
import FileData from '../models/file-data';

/**
 * 上传下载进度变更通知最小时间间隔，单位毫秒
 * @type {number}
 * @private
 */
const MIN_PROGRESS_CHANGE_INTERVAL = 1000;

/**
 * 检查文件大小是否支持上传到当前服务器
 * @param {number} size 文件大小，单位字节
 * @return {boolean}
 * @export
 */
export const checkUploadFileSize = (size) => {
    if (typeof size === 'object') {
        size = size.size;
    }
    const {uploadFileSize} = profile.user;
    return uploadFileSize && size <= uploadFileSize;
};

/**
 * 查询指定类型的文件
 * @param {String} category 文件类别，包括 doc（文档），image（图片），program（程序）
 * @param {number} [limit=0] 返回结果的最大数目限制
 * @param {number} [offset=0] 查询时略过的结果数目
 * @param {boolean} [reverse=true] 是否以倒序返回结果
 * @param {boolean} [returnCount=true] 是否仅仅返回结果数目
 * @return {{Promise<Array<FileData>>}}
 * @export
 */
export const loadFiles = (category = '', limit = 0, offset = 0, reverse = true, returnCount = false) => {
    category = category ? category.toLowerCase() : false;
    return getChatMessages(null, x => x.contentType === 'file', limit, offset, reverse, true, true, returnCount).then(data => {
        if (data && data.length) {
            const files = data.map(x => FileData.create(JSON.parse(x.content))).filter(x => ((!category || x.category === category) && x.isOK));
            return Promise.resolve(files);
        }
        return Promise.resolve([]);
    });
};

/**
 * 搜索文件
 * @param {String} keys 搜索关键字，包括 doc（文档），image（图片），program（程序）
 * @param {String} category 文件类别
 * @return {{Promise<Array<FileData>>}}
 * @export
 */
export const searchFiles = (keys, category = '') => {
    return loadFiles(category).then(files => {
        keys = keys ? keys.trim().toLowerCase().split(' ') : null;
        if (keys && keys.length) {
            const result = [];
            files.forEach(file => {
                const score = file.getMatchScore(keys);
                if (score) {
                    result.push({score, file});
                }
            });
            result.sort((x, y) => y.score - x.score);
            return Promise.resolve(result.map(x => x.file));
        }
        return Promise.resolve(files);
    });
};

/**
 * 上传文件
 * @param {Object|FileData} file 要上传的文件对象
 * @param {Function(progress: number, file: FileData)} onProgress 文件上传进度变更回调函数
 * @param {boolean} copyCache 是否将文件拷贝到用户缓存目录
 * @return {{Promise<Object>}}
 * @export
 */
export const uploadFile = (file, onProgress, copyCache) => {
    file = FileData.create(file);
    let progressTime = 0;
    let lastProgress = 0;
    return API.uploadFile(profile.user, file, progress => {
        const now = new Date().getTime();
        if (progress !== lastProgress && (now - progressTime) > MIN_PROGRESS_CHANGE_INTERVAL) {
            progressTime = now;
            lastProgress = progress;
            if (onProgress) {
                onProgress(progress, file);
            }
        }
    }, copyCache);
};

/**
 * 上传图片文件
 * @param {Object|FileData} file 要上传的文件对象
 * @param {Function(progress: number, file: FileData)} onProgress 文件上传进度变更回调函数
 * @return {{Promise<Object>}}
 * @export
 */
export const uploadImageFile = (file, onProgress) => {
    return uploadFile(file, onProgress, true);
};

/**
 * 下载文件
 * @param {Object|FileData} file 要下载的文件对象
 * @param {Function(progress: number, file: FileData)} onProgress 文件下载进度变更回调函数
 * @return {{Promise<Object>}}
 * @export
 */
export const downloadFile = (file, onProgress) => {
    file = FileData.create(file);
    return API.downloadFile(profile.user, file, onProgress);
};

/**
 * 检查文件是否已缓存
 * @param {Object|FileData} file 要检查的文件对象
 * @return {{Promise<boolean>}}
 * @export
 */
export const checkFileCache = file => {
    return API.checkFileCache(file, profile.user);
};

export default {
    loadFiles,
    downloadFile,
    search: searchFiles,
    uploadFile,
    uploadImageFile,
    checkUploadFileSize,
    checkCache: checkFileCache
};
