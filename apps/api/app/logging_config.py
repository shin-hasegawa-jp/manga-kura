import logging


def configure_logging() -> None:
    # Uvicornのアクセスログにはクエリ文字列が含まれるため無効化する。
    # アプリケーションログはエラーコード、HTTPメソッド、パスだけを記録する。
    logging.getLogger("uvicorn.access").disabled = True
