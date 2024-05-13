import { Component, triggerEvent, getValueFromProps } from '../_util/simply';
import { UploaderDefaultProps, File, LocalFile } from './props';
import { chooseImage } from '../_util/jsapi/choose-image';
import createValue from '../mixins/value';

Component(
  UploaderDefaultProps,
  {
    async chooseImage() {
      const [onBeforeUpload, onUpload] = getValueFromProps(this, [
        'onBeforeUpload',
        'onUpload',
      ]);
      if (!onUpload) {
        throw new Error('need props onUpload');
      }
      const fileList = this.getValue();
      const [maxCount, sourceType] = getValueFromProps(this, [
        'maxCount',
        'sourceType',
      ]);

      let localFileList: LocalFile[];
      try {
        const chooseImageRes = await chooseImage({
          count:
            typeof maxCount === 'undefined'
              ? Infinity
              : maxCount - fileList.length,
          sourceType,
        });
        localFileList = (
          chooseImageRes.tempFiles ||
          chooseImageRes.tempFilePaths ||
          chooseImageRes.apFilePaths ||
          chooseImageRes.filePaths ||
          []
        )
          .map((item) => {
            if (typeof item === 'string') {
              return {
                path: item,
              };
            }
            if (item.path) {
              return {
                path: item.path,
                size: item.size,
              };
            }
          })
          .filter((item) => !!item);
      } catch (err) {
        triggerEvent(this, 'chooseImageError', err);
        return;
      }

      if (onBeforeUpload) {
        try {
          const beforeUploadRes = await onBeforeUpload(localFileList);
          if (beforeUploadRes === false) {
            return;
          }
          if (Array.isArray(beforeUploadRes)) {
            localFileList = beforeUploadRes;
          }
        } catch (err) {
          return;
        }
      }

      const tasks = localFileList.map((file) => this.uploadFile(file));
      await Promise.all(tasks);
    },

    async uploadFile(localFile: LocalFile) {
      const onUpload = getValueFromProps(this, 'onUpload');

      const uid = this.getCount();
      const tempFileList = [
        ...this.getValue(),
        {
          path: localFile.path,
          size: localFile.size,
          uid,
          status: 'uploading',
        },
      ];

      if (!this.isControlled()) {
        this.update(tempFileList);
      }

      triggerEvent(this, 'change', tempFileList);

      try {
        const url = await onUpload(localFile);
        if (typeof url !== 'string' || !url) {
          this.updateFile(uid, {
            status: 'error',
          });
          return;
        }
        this.updateFile(uid, {
          status: 'done',
          url,
        });
      } catch (err) {
        this.updateFile(uid, {
          status: 'error',
        });
      }
    },

    updateFile(uid: string, file: Partial<File>) {
      const fileList = this.getValue();
      const tempFileList = fileList.map((item) => {
        if (item.uid === uid) {
          return {
            ...item,
            ...file,
          };
        }
        return item;
      });
      if (!this.isControlled()) {
        this.update(tempFileList);
      }

      triggerEvent(this, 'change', tempFileList);
    },

    async onRemove(e) {
      const fileList = this.getValue();
      const onRemove = getValueFromProps(this, 'onRemove');
      const { uid } = e.currentTarget.dataset;
      const file = fileList.find((item) => item.uid === uid);

      if (onRemove) {
        const result = await onRemove(file);
        if (result === false) {
          return;
        }
      }
      const tempFileList = fileList.filter((item) => item.uid !== uid);
      if (!this.isControlled()) {
        this.update(tempFileList);
      }

      triggerEvent(this, 'change', tempFileList);
    },

    onPreview(e) {
      const { uid } = e.currentTarget.dataset;
      const fileList = this.getValue();
      const file = fileList.find((item) => item.uid === uid);
      triggerEvent(this, 'preview', file);
    },
    updateShowUploadButton() {
      const maxCount = getValueFromProps(this, 'maxCount');
      this.setData({
        showUploadButton: !maxCount || this.getValue().length < maxCount,
      });
    },
    count: 0,

    getCount() {
      // 使用 Date.now() 与 useId 作为前缀，防止每次前缀都相同
      this.count = (this.count || 0) + 1;
      // 使用 Date.now() 与 useId 作为前缀，防止每次前缀都相同
      const prefix = Math.random() + '-' + Date.now();
      return `${prefix}-${this.count}`;
    },
  },
  null,
  [
    createValue({
      defaultValueKey: 'defaultFileList',
      valueKey: 'fileList',
      transformValue(fileList = []) {
        return {
          needUpdate: true,
          value: fileList.map((item) => {
            const file = {
              ...item,
            };
            if (typeof item.url === 'undefined') {
              file.url = '';
            }
            if (typeof item.uid === 'undefined') {
              file.uid = this.getCount();
            }
            if (typeof item.status === 'undefined') {
              file.status = 'done';
            }
            return file;
          }),
        };
      },
    }),
  ],
  {
    didMount() {
      this.updateShowUploadButton();
    },
    didUpdate(prevProps, prevData) {
      if (!this.isEqualValue(prevData)) {
        this.updateShowUploadButton();
      }
    },
  }
);
